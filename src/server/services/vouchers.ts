import "server-only";

import { randomBytes } from "node:crypto";

import type { OfferRequestStatus, Prisma, VoucherStatus } from "@/generated/prisma/client";
import { offerHeadline, snapshotTerms } from "@/lib/offer";
import { formatDhakaDate } from "@/lib/time";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { writeAudit } from "@/server/services/audit";
import { notifyCustomer } from "@/server/services/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Allowed voucher status moves. Terminal states have none. */
const VOUCHER_TRANSITIONS: Record<VoucherStatus, readonly VoucherStatus[]> = {
  ACTIVE: ["REDEEMED", "EXPIRED", "VOID"],
  REDEEMED: [],
  EXPIRED: [],
  VOID: [],
};

/**
 * THE way to change a voucher's status (call inside a transaction). Conditional on the current status
 * (+ any extra guards), so concurrent callers can't both succeed: returns true only for the winner.
 */
export async function transitionVoucher(
  tx: Prisma.TransactionClient,
  id: string,
  from: VoucherStatus,
  to: VoucherStatus,
  guard: Prisma.VoucherWhereInput = {},
): Promise<boolean> {
  if (!VOUCHER_TRANSITIONS[from].includes(to)) throw new Error(`Illegal voucher transition ${from} -> ${to}`);
  const { count } = await tx.voucher.updateMany({ where: { ...guard, id, status: from }, data: { status: to } });
  return count === 1;
}

/** 18 random bytes -> 24 base64url chars (144 bits). Unguessable; the unique index is a backstop. */
export function generateVoucherCode(): string {
  return randomBytes(18).toString("base64url");
}

/** Bulk form of transitionVoucher (same transition rules), for jobs like expiry. Returns rows changed. */
export async function transitionVouchers(
  tx: Prisma.TransactionClient,
  where: Prisma.VoucherWhereInput,
  from: VoucherStatus,
  to: VoucherStatus,
): Promise<number> {
  if (!VOUCHER_TRANSITIONS[from].includes(to)) throw new Error(`Illegal voucher transition ${from} -> ${to}`);
  const { count } = await tx.voucher.updateMany({ where: { ...where, status: from }, data: { status: to } });
  return count;
}

export type ReviewFailure =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_reviewed"; status: OfferRequestStatus }
  | { ok: false; reason: "campaign_not_found" | "campaign_inactive" | "campaign_not_started" | "campaign_ended" }
  | { ok: false; reason: "budget_exceeded"; remaining: number; needed: number }
  | { ok: false; reason: "customer_limit_reached"; limit: number };

export type ApproveResult = { ok: true; voucherId: string; code: string; expiresAt: Date } | ReviewFailure;
export type RejectResult = { ok: true } | ReviewFailure;

/**
 * Approves a PENDING request and issues its voucher, all in one transaction.
 *
 * Concurrency: locks the campaign row, then the request row (always in that order, so no deadlocks).
 * - Same request approved twice at once: the second waits on the request lock, then sees APPROVED.
 * - Different requests on one campaign: serialised by the campaign lock, so budget and
 *   per-customer checks can't be raced.
 * The unique Voucher.offerRequestId is a last-resort backstop.
 */
export async function approveOfferRequest(requestId: string, campaignId: string, staffId: string): Promise<ApproveResult> {
  const now = new Date();

  const result = await db.$transaction(async (tx): Promise<ApproveResult & { customerId?: string; offer?: string }> => {
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "OfferRequest" WHERE id = ${requestId} FOR UPDATE`;

    const request = await tx.offerRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, customerId: true, invoiceNumber: true },
    });
    if (!request) return { ok: false, reason: "not_found" };
    if (request.status !== "PENDING") return { ok: false, reason: "already_reviewed", status: request.status };

    const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { ok: false, reason: "campaign_not_found" };
    if (!campaign.active) return { ok: false, reason: "campaign_inactive" };
    if (campaign.startsAt > now) return { ok: false, reason: "campaign_not_started" };
    if (campaign.endsAt && campaign.endsAt <= now) return { ok: false, reason: "campaign_ended" };

    const terms = snapshotTerms(campaign);

    if (campaign.totalBudget != null) {
      const issued = await tx.voucher.aggregate({
        where: { campaignId, status: { not: "VOID" } },
        _sum: { faceValue: true },
      });
      const used = issued._sum.faceValue ?? 0;
      if (used + terms.faceValue > campaign.totalBudget) {
        return { ok: false, reason: "budget_exceeded", remaining: campaign.totalBudget - used, needed: terms.faceValue };
      }
    }

    if (campaign.perCustomerLimit != null) {
      const held = await tx.voucher.count({
        where: { campaignId, customerId: request.customerId, status: { not: "VOID" } },
      });
      if (held >= campaign.perCustomerLimit) {
        return { ok: false, reason: "customer_limit_reached", limit: campaign.perCustomerLimit };
      }
    }

    // Conditional update: a second guard on top of the row lock.
    const updated = await tx.offerRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: staffId, reviewedAt: now },
    });
    if (updated.count !== 1) return { ok: false, reason: "already_reviewed", status: "APPROVED" };

    const voucher = await tx.voucher.create({
      data: {
        offerRequestId: requestId,
        campaignId,
        customerId: request.customerId,
        code: generateVoucherCode(),
        status: "ACTIVE",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + campaign.validityDays * DAY_MS),
        ...terms,
      },
      select: { id: true, code: true, expiresAt: true },
    });

    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: "offer_request.approved",
        entityType: "OfferRequest",
        entityId: requestId,
        meta: { invoiceNumber: request.invoiceNumber, campaignId, voucherId: voucher.id, faceValue: terms.faceValue },
      },
      tx,
    );

    return {
      ok: true,
      voucherId: voucher.id,
      code: voucher.code,
      expiresAt: voucher.expiresAt,
      customerId: request.customerId,
      offer: offerHeadline(terms),
    };
  });

  if (result.ok && result.customerId) {
    const offer = result.offer;
    const until = formatDhakaDate(result.expiresAt);
    const link = `${appUrl()}/dashboard`;
    await notifyCustomer(result.customerId, {
      sms: `Hosting.com Coffee Campaign: your coffee voucher (${offer}) is ready! Valid until ${until}. View it: ${link}`,
      emailSubject: `Your Hosting.com Coffee Campaign voucher is ready (${offer})`,
      purpose: "review",
      email: `Good news! Your invoice was verified and your voucher (${offer}) is ready.\n\nValid until ${until} (Dhaka time). Use it at any partner coffee shop.\n\nView your voucher: ${link}`,
    });
  }

  if (!result.ok) return result;
  return { ok: true, voucherId: result.voucherId, code: result.code, expiresAt: result.expiresAt };
}

/** Rejects a PENDING request with a customer-facing reason, then notifies the customer. */
export async function rejectOfferRequest(requestId: string, reason: string, staffId: string): Promise<RejectResult> {
  const now = new Date();

  const result = await db.$transaction(async (tx): Promise<RejectResult & { customerId?: string; invoiceNumber?: string }> => {
    const updated = await tx.offerRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: reason, reviewedById: staffId, reviewedAt: now },
    });
    const request = await tx.offerRequest.findUnique({
      where: { id: requestId },
      select: { status: true, customerId: true, invoiceNumber: true },
    });
    if (!request) return { ok: false, reason: "not_found" };
    if (updated.count !== 1) return { ok: false, reason: "already_reviewed", status: request.status };

    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: "offer_request.rejected",
        entityType: "OfferRequest",
        entityId: requestId,
        meta: { invoiceNumber: request.invoiceNumber, reason },
      },
      tx,
    );
    return { ok: true, customerId: request.customerId, invoiceNumber: request.invoiceNumber };
  });

  if (result.ok && result.customerId) {
    const link = `${appUrl()}/dashboard`;
    const why = asSentence(reason);
    await notifyCustomer(result.customerId, {
      sms: `Hosting.com Coffee Campaign: invoice ${result.invoiceNumber} was not approved. Reason: ${why} Details: ${link}`,
      emailSubject: "Update on your Hosting.com Coffee Campaign request",
      purpose: "review",
      email: `We reviewed invoice ${result.invoiceNumber} and couldn't approve it.\n\nReason: ${why}\n\nIf you think this is a mistake, reply to this email. You can see your requests here: ${link}`,
    });
  }

  return result.ok ? { ok: true } : result;
}

/** Ensures exactly one terminal punctuation mark ("Unpaid." / "Unpaid" -> "Unpaid."). */
function asSentence(text: string): string {
  const t = text.trim().replace(/[.\s]+$/, "");
  return /[!?]$/.test(t) ? t : `${t}.`;
}
