import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { offerHeadline } from "@/lib/offer";
import { redemptionRef } from "@/lib/redemption";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { writeAudit } from "@/server/services/audit";
import { issueVoucher, type ReviewFailure } from "@/server/services/vouchers";

/**
 * Upmind (hosting.com billing) integration.
 *
 * In: when an invoice is paid, Upmind POSTs the customer + invoice to /api/integrations/upmind/vouchers.
 *     `validatedCode` = hex HMAC-SHA256(UPMIND_SECRET, `${invoiceNumber}:${email}`) over the values exactly
 *     as sent. We issue a voucher from the campaign marked "auto-issue" (Upmind emails the customer).
 * Out: when that voucher is redeemed, we POST a `voucher.redeemed` event to UPMIND_REDEMPTION_URL, echoing
 *     the validatedCode. The row is written in the redeem transaction and sent after commit, with retries.
 * Spec for Upmind: docs/UPMIND-INTEGRATION.md.
 */

export const UPMIND_SECRET_MIN = 32;

export function upmindSecret(): string | null {
  const s = process.env.UPMIND_SECRET;
  return s && s.length >= UPMIND_SECRET_MIN ? s : null;
}

export function upmindRedemptionUrl(): string | null {
  const u = process.env.UPMIND_REDEMPTION_URL;
  if (!u) return null;
  try {
    const url = new URL(u);
    // Plain http only for local testing.
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validatedCodeFor(secret: string, invoiceNumber: string, email: string): string {
  return createHmac("sha256", secret).update(`${invoiceNumber}:${email}`).digest("hex");
}

export function checkValidatedCode(secret: string, invoiceNumber: string, email: string, code: string): boolean {
  const expected = Buffer.from(validatedCodeFor(secret, invoiceNumber, email), "utf8");
  const given = Buffer.from(code.trim().toLowerCase(), "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// ------------------------------------------------------------------------------------------- inbound

export type UpmindIssueInput = { customerName: string; email: string; phone: string; invoiceNumber: string; validatedCode: string };

export type PendingReason = "no_auto_campaign" | "contact_conflict" | "awaiting_review" | ReviewFailure["reason"];

export type UpmindIssueResult =
  | { kind: "issued" | "already_issued"; offerRequestId: string; voucher: { offer: string; expiresAt: Date } }
  | { kind: "pending_review"; offerRequestId: string; reason: PendingReason }
  | { kind: "rejected"; offerRequestId: string }
  | { kind: "conflict"; reason: "invoice_used" };

const DUPLICATE_KEY = "P2002";

/**
 * Creates (or finds) the customer and request for a paid invoice, then issues the voucher from the
 * auto-issue campaign. Idempotent per invoice: a repeat push with the same email returns the current state.
 * Existing customers' email/phone are never changed (same rule as the public form).
 */
export async function issueUpmindVoucher(input: UpmindIssueInput): Promise<UpmindIssueResult> {
  try {
    return await issueOnce(input);
  } catch (err) {
    // Lost a race on a unique key (same invoice pushed twice at once, or a brand-new customer): once more.
    if ((err as { code?: string }).code !== DUPLICATE_KEY) throw err;
    return issueOnce(input);
  }
}

async function issueOnce(input: UpmindIssueInput): Promise<UpmindIssueResult> {
  const now = new Date();
  const existing = await db.offerRequest.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
    select: { id: true, source: true, submittedEmail: true },
  });
  if (existing) {
    if (existing.source !== "UPMIND" || existing.submittedEmail !== input.email) return { kind: "conflict", reason: "invoice_used" };
    return currentState(existing.id, "already_issued");
  }

  const created = await db.$transaction(async (tx) => {
    const byEmail = await tx.customer.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true, name: true } });
    const byPhone = await tx.customer.findFirst({ where: { phone: input.phone, deletedAt: null }, select: { id: true } });
    // The phone belongs to a different account than the email: issue nothing until support decides.
    const contactConflict = !byEmail && !!byPhone;
    const customer =
      byEmail ??
      (contactConflict
        ? byPhone
        : await tx.customer.create({ data: { email: input.email, phone: input.phone, name: input.customerName || null }, select: { id: true, name: true } }));
    if (byEmail && !byEmail.name && input.customerName) await tx.customer.update({ where: { id: byEmail.id }, data: { name: input.customerName } });

    const request = await tx.offerRequest.create({
      data: {
        customerId: customer!.id,
        invoiceNumber: input.invoiceNumber,
        submittedEmail: input.email,
        submittedPhone: input.phone,
        customerName: input.customerName || null,
        upmindCode: input.validatedCode.trim().toLowerCase(),
        source: "UPMIND",
        status: "PENDING",
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorType: "SYSTEM",
        actorId: "system",
        action: "offer_request.received",
        entityType: "OfferRequest",
        entityId: request.id,
        meta: { via: "upmind", invoiceNumber: input.invoiceNumber, newCustomer: !byEmail && !byPhone, contactConflict },
      },
      tx,
    );
    return { requestId: request.id, contactConflict };
  });

  if (created.contactConflict) return { kind: "pending_review", offerRequestId: created.requestId, reason: "contact_conflict" };

  const campaign = await autoIssueCampaign(now);
  if (!campaign) return { kind: "pending_review", offerRequestId: created.requestId, reason: "no_auto_campaign" };

  const issued = await db.$transaction((tx) => issueVoucher(tx, created.requestId, campaign.id, { type: "SYSTEM", via: "upmind" }, now));
  if (!issued.ok) return { kind: "pending_review", offerRequestId: created.requestId, reason: issued.reason };
  return { kind: "issued", offerRequestId: created.requestId, voucher: { offer: issued.offer ?? "", expiresAt: issued.expiresAt } };
}

/** The running campaign marked for automatic issue, if any. */
export async function autoIssueCampaign(now = new Date()) {
  return db.campaign.findFirst({
    where: { autoIssue: true, active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { id: true, name: true },
  });
}

async function currentState(offerRequestId: string, issuedKind: "issued" | "already_issued"): Promise<UpmindIssueResult> {
  const r = await db.offerRequest.findUniqueOrThrow({
    where: { id: offerRequestId },
    select: { status: true, voucher: { select: { offerType: true, value: true, maxDiscount: true, minBill: true, expiresAt: true } } },
  });
  if (r.status === "APPROVED" && r.voucher) return { kind: issuedKind, offerRequestId, voucher: { offer: offerHeadline(r.voucher), expiresAt: r.voucher.expiresAt } };
  if (r.status === "REJECTED") return { kind: "rejected", offerRequestId };
  return { kind: "pending_review", offerRequestId, reason: "awaiting_review" };
}

/** Audit-free log of every inbound call (invoice number only; never contacts or the code). */
export async function logUpmindInbound(row: { invoiceNumber?: string | null; outcome: string; httpStatus: number; detail?: string; offerRequestId?: string }) {
  await db.upmindInbound.create({ data: { ...row, invoiceNumber: row.invoiceNumber?.slice(0, 64) ?? null, detail: row.detail?.slice(0, 300) } });
}

export function dashboardUrl(): string {
  return `${appUrl()}/dashboard`;
}

// ------------------------------------------------------------------------------------------ outbound

/** Paisa -> "1000.00" (no floats). */
export function taka(paisa: number): string {
  return `${Math.floor(paisa / 100)}.${String(paisa % 100).padStart(2, "0")}`;
}

/**
 * Called inside the redeem transaction: if the voucher came from Upmind, write the callback row
 * (outbox). Sending happens after commit (deliverUpmindRedemption) and on cron retries.
 */
export async function queueUpmindRedemption(tx: Prisma.TransactionClient, redemptionId: string): Promise<boolean> {
  const r = await tx.redemption.findUniqueOrThrow({
    where: { id: redemptionId },
    select: {
      id: true,
      redeemedAt: true,
      billAmount: true,
      discountAmount: true,
      customerPaid: true,
      branch: { select: { name: true, branchCode: true, partner: { select: { name: true } } } },
      voucher: {
        select: {
          offerType: true,
          value: true,
          maxDiscount: true,
          minBill: true,
          offerRequest: { select: { source: true, invoiceNumber: true, upmindCode: true } },
        },
      },
    },
  });
  const req = r.voucher.offerRequest;
  if (req.source !== "UPMIND" || !req.upmindCode) return false;

  const payload = {
    event: "voucher.redeemed",
    invoiceNumber: req.invoiceNumber,
    validatedCode: req.upmindCode,
    redemption: {
      reference: redemptionRef(r.id),
      redeemedAt: r.redeemedAt.toISOString(),
      cafe: r.branch.partner.name,
      branch: r.branch.name,
      branchCode: r.branch.branchCode,
      currency: "BDT",
      billAmount: taka(r.billAmount),
      discountAmount: taka(r.discountAmount),
      customerPaid: taka(r.customerPaid),
    },
    voucher: { offer: offerHeadline(r.voucher) },
  };
  await tx.upmindDelivery.create({ data: { redemptionId: r.id, invoiceNumber: req.invoiceNumber, payload } });
  return true;
}

/** Minutes to wait after attempt n fails (n = 1, 2, ...). After the last one the delivery is FAILED. */
export const UPMIND_RETRY_MINUTES = [1, 5, 30, 120, 360, 720, 1440] as const;
const SEND_TIMEOUT_MS = 10_000;

export type DeliveryOutcome = { id: string; status: "SENT" | "PENDING" | "FAILED"; httpStatus?: number; error?: string };

/** One attempt for one delivery. Safe to call concurrently: the row is claimed with a conditional update. */
export async function deliverUpmind(id: string, opts: { force?: boolean } = {}): Promise<DeliveryOutcome | null> {
  const now = new Date();
  const claim = await db.upmindDelivery.updateMany({
    where: { id, status: opts.force ? { in: ["PENDING", "FAILED"] } : "PENDING", ...(opts.force ? {} : { nextAttemptAt: { lte: now } }) },
    // Push the next attempt out first, so a crash mid-send doesn't make it retry immediately in a loop.
    data: { status: "PENDING", attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + 10 * 60_000) },
  });
  if (claim.count !== 1) return null;
  const row = await db.upmindDelivery.findUniqueOrThrow({ where: { id }, select: { attempts: true, payload: true } });

  const url = upmindRedemptionUrl();
  let httpStatus: number | undefined;
  let error: string | undefined;
  if (!url) {
    error = "UPMIND_REDEMPTION_URL is not set (or not https)";
  } else {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "HostingCoffeeCampaign/1.0" },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      httpStatus = res.status;
      if (!res.ok) error = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "request failed";
    }
  }

  if (!error) {
    await db.upmindDelivery.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastStatus: httpStatus, lastError: null } });
    return { id, status: "SENT", httpStatus };
  }
  const wait = UPMIND_RETRY_MINUTES.at(row.attempts - 1);
  const status = wait === undefined ? "FAILED" : "PENDING";
  await db.upmindDelivery.update({
    where: { id },
    data: { status, lastStatus: httpStatus ?? null, lastError: error.slice(0, 300), nextAttemptAt: new Date(Date.now() + (wait ?? 0) * 60_000) },
  });
  return { id, status, httpStatus, error };
}

/** After a redemption commits: send its callback now (if it has one). Never throws. */
export async function deliverUpmindRedemption(redemptionId: string): Promise<void> {
  try {
    const row = await db.upmindDelivery.findUnique({ where: { redemptionId }, select: { id: true } });
    if (row) await deliverUpmind(row.id);
  } catch (err) {
    console.error("upmind delivery failed:", err instanceof Error ? err.message : "unknown error");
  }
}

/** Cron: retry every due callback. */
export async function retryUpmindDeliveries(max = 50): Promise<{ attempted: number; sent: number }> {
  const due = await db.upmindDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: max,
    select: { id: true },
  });
  let sent = 0;
  for (const d of due) if ((await deliverUpmind(d.id))?.status === "SENT") sent++;
  return { attempted: due.length, sent };
}

/** Staff: send a pending or failed callback again right now. */
export async function retryUpmindDeliveryNow(id: string, staffId: string): Promise<DeliveryOutcome | null> {
  const out = await deliverUpmind(id, { force: true });
  if (out) {
    await writeAudit({ actorType: "STAFF", actorId: staffId, action: "upmind.delivery_retried", entityType: "UpmindDelivery", entityId: id, meta: { result: out.status } });
  }
  return out;
}

// --------------------------------------------------------------------------------------------- admin

export async function upmindOverview() {
  const [campaign, inbound, deliveries, pending, failed] = await Promise.all([
    autoIssueCampaign(),
    db.upmindInbound.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.upmindDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, redemptionId: true, invoiceNumber: true, status: true, attempts: true, lastStatus: true, lastError: true, nextAttemptAt: true, sentAt: true, createdAt: true },
    }),
    db.upmindDelivery.count({ where: { status: "PENDING" } }),
    db.upmindDelivery.count({ where: { status: "FAILED" } }),
  ]);
  const url = upmindRedemptionUrl();
  return {
    configured: !!upmindSecret(),
    callbackHost: url ? new URL(url).host : null,
    campaign,
    inbound,
    deliveries,
    pending,
    failed,
  };
}
