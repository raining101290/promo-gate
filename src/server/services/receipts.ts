import "server-only";

import { randomBytes } from "node:crypto";

import { RECEIPT_MAX_BYTES, RECEIPT_TYPES, type ReceiptContentType } from "@/lib/schemas/receipt";
import { db } from "@/server/db";
import { getStorage, signedUrlTtl, type UploadTicket } from "@/server/providers/storage";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";
import { transitionRedemption } from "@/server/services/redemptions";

const UPLOAD_URL_TTL_SECONDS = 300;
const UPLOADABLE = ["CLAIMED", "RECEIPT_UPLOADED"] as const;

export type ReceiptFailure = {
  ok: false;
  reason: "not_found" | "not_uploadable" | "rate_limited" | "bad_key" | "missing" | "too_large" | "bad_type" | "state_changed";
};

const keyPrefix = (redemptionId: string) => `receipts/${redemptionId.toLowerCase()}/`;

/** Step 1: a presigned PUT for the customer's own CLAIMED/RECEIPT_UPLOADED redemption. */
export async function createReceiptUpload(
  customerId: string,
  redemptionId: string,
  file: { contentType: ReceiptContentType; size: number },
): Promise<{ ok: true; key: string; upload: UploadTicket } | ReceiptFailure> {
  const r = await db.redemption.findFirst({ where: { id: redemptionId, customerId }, select: { status: true } });
  if (!r) return { ok: false, reason: "not_found" };
  if (!(UPLOADABLE as readonly string[]).includes(r.status)) return { ok: false, reason: "not_uploadable" };

  if (!(await limit("receiptUpload", redemptionId)).allowed) return { ok: false, reason: "rate_limited" };

  const key = `${keyPrefix(redemptionId)}${randomBytes(8).toString("hex")}.${RECEIPT_TYPES[file.contentType]}`;
  const upload = await getStorage().createUploadUrl(key, {
    contentType: file.contentType,
    contentLength: file.size,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
  return { ok: true, key, upload };
}

/** Magic numbers: don't trust the declared Content-Type. */
function sniff(bytes: Uint8Array): ReceiptContentType | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) return "image/png";
  const ascii = String.fromCharCode(...bytes.slice(4, 12));
  if (ascii.startsWith("ftyp")) {
    const brand = ascii.slice(4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
    if (["mif1", "msf1"].includes(brand)) return "image/heif";
  }
  return null;
}

/**
 * Step 2: after the browser PUT succeeds. Verifies the stored object (exists, size, real image bytes),
 * then moves the redemption to RECEIPT_UPLOADED (replacing an earlier photo is allowed until review).
 */
export async function completeReceiptUpload(
  customerId: string,
  redemptionId: string,
  input: { key: string; posReceiptNo?: string },
): Promise<{ ok: true; replaced: boolean } | ReceiptFailure> {
  if (!input.key.startsWith(keyPrefix(redemptionId))) return { ok: false, reason: "bad_key" };
  const storage = getStorage();

  const head = await storage.head(input.key);
  if (!head) return { ok: false, reason: "missing" };
  if (head.size > RECEIPT_MAX_BYTES) {
    await storage.delete(input.key);
    return { ok: false, reason: "too_large" };
  }
  const declared = head.contentType as ReceiptContentType | null;
  const actual = sniff((await storage.readStart(input.key, 16)) ?? new Uint8Array());
  // HEIC/HEIF brands overlap; treat them as one family.
  const family = (t: string | null) => (t === "image/heif" ? "image/heic" : t);
  if (!actual || family(actual) !== family(declared)) {
    await storage.delete(input.key);
    return { ok: false, reason: "bad_type" };
  }

  const result = await db.$transaction(async (tx) => {
    const before = await tx.redemption.findFirst({ where: { id: redemptionId, customerId }, select: { receiptImageKey: true } });
    if (!before) return { ok: false, reason: "not_found" } as const;
    const moved = await transitionRedemption(
      tx,
      redemptionId,
      UPLOADABLE,
      "RECEIPT_UPLOADED",
      { receiptImageKey: input.key, ...(input.posReceiptNo !== undefined ? { posReceiptNo: input.posReceiptNo } : {}) },
      { customerId },
    );
    if (!moved) return { ok: false, reason: "state_changed" } as const;
    await writeAudit(
      {
        actorType: "CUSTOMER",
        actorId: customerId,
        action: "redemption.receipt_uploaded",
        entityType: "Redemption",
        entityId: redemptionId,
        meta: { key: input.key, size: head.size, contentType: actual, posReceiptNo: input.posReceiptNo ?? null, replaced: before.receiptImageKey },
      },
      tx,
    );
    return { ok: true, previous: before.receiptImageKey } as const;
  });

  if (!result.ok) {
    await storage.delete(input.key);
    return result;
  }
  if (result.previous && result.previous !== input.key) await storage.delete(result.previous).catch(() => {});
  return { ok: true, replaced: !!result.previous };
}

/**
 * Staff only (caller enforces the role): a short-lived presigned GET. Full views are audited; list
 * thumbnails are not (they'd write one row per row per page load) but still use presigned URLs.
 */
export async function issueReceiptViewUrl(redemptionId: string, staffId: string, opts: { audit: boolean } = { audit: true }): Promise<string | null> {
  const r = await db.redemption.findUnique({ where: { id: redemptionId }, select: { receiptImageKey: true } });
  if (!r?.receiptImageKey) return null;
  const ttl = signedUrlTtl();
  if (opts.audit) await writeAudit({
    actorType: "STAFF",
    actorId: staffId,
    action: "redemption.receipt_viewed",
    entityType: "Redemption",
    entityId: redemptionId,
    meta: { ttlSeconds: ttl },
  });
  return getStorage().createViewUrl(r.receiptImageKey, ttl);
}
