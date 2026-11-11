import "server-only";

import type { Prisma, RedemptionStatus } from "@/generated/prisma/client";
import { dhakaDayStart } from "@/lib/time";
import { db } from "@/server/db";
import { writeAudit } from "@/server/services/audit";
import { computeFraudSignals } from "@/server/services/fraud-signals";
import { transitionRedemption } from "@/server/services/redemptions";

/** A redemption still without a receipt this long after redeeming is flagged (never auto-rejected). */
export const RECEIPT_GRACE_MS = 24 * 60 * 60 * 1000;
export const QUEUE_PAGE_SIZE = 50;

export type ReviewAction = "verify" | "dispute" | "reject";

const FROM: Record<ReviewAction, readonly RedemptionStatus[]> = {
  verify: ["CLAIMED", "RECEIPT_UPLOADED", "DISPUTED"],
  dispute: ["CLAIMED", "RECEIPT_UPLOADED"],
  reject: ["CLAIMED", "RECEIPT_UPLOADED", "DISPUTED"],
};
const TO: Record<ReviewAction, RedemptionStatus> = { verify: "VERIFIED", dispute: "DISPUTED", reject: "REJECTED" };

export type ReviewResult =
  | { ok: true; status: RedemptionStatus }
  | { ok: false; reason: "not_found" | "no_receipt" | "in_settlement" }
  | { ok: false; reason: "wrong_status"; status: RedemptionStatus };

/**
 * Staff decision on a redemption (SUPPORT/ADMIN; caller enforces the role).
 * verify normally checks an uploaded receipt. Without one it needs a reason saying how staff confirmed the sale
 * (e.g. the café's POS record): the cashier's PIN already proves the café accepted it, and the café must not go
 * unpaid because a customer never uploaded. dispute/reject always need a reason.
 * Redemptions already attached to a settlement can't change.
 */
export async function reviewRedemption(id: string, action: ReviewAction, staffId: string, reason?: string): Promise<ReviewResult> {
  return db.$transaction(async (tx) => {
    const r = await tx.redemption.findUnique({ where: { id }, select: { status: true, receiptImageKey: true, settlementId: true } });
    if (!r) return { ok: false, reason: "not_found" };
    if (r.settlementId) return { ok: false, reason: "in_settlement" };
    if (!FROM[action].includes(r.status)) return { ok: false, reason: "wrong_status", status: r.status };
    const withoutReceipt = action === "verify" && !r.receiptImageKey;
    if (withoutReceipt && !reason) return { ok: false, reason: "no_receipt" };

    const now = new Date();
    const moved = await transitionRedemption(
      tx,
      id,
      FROM[action],
      TO[action],
      {
        reviewedAt: now,
        reviewNote: action === "verify" && !withoutReceipt ? null : (reason ?? null),
        ...(action === "verify" ? { verifiedById: staffId } : {}),
      },
      { settlementId: null },
    );
    if (!moved) {
      const now2 = await tx.redemption.findUnique({ where: { id }, select: { status: true } });
      return { ok: false, reason: "wrong_status", status: now2?.status ?? r.status };
    }
    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: `redemption.${TO[action].toLowerCase()}`,
        entityType: "Redemption",
        entityId: id,
        meta: { from: r.status, to: TO[action], reason: reason ?? null, ...(withoutReceipt ? { withoutReceipt: true } : {}) },
      },
      tx,
    );
    return { ok: true, status: TO[action] };
  });
}

export type QueueFilter = {
  status?: RedemptionStatus;
  flagged?: boolean;
  partnerId?: string;
  branchId?: string;
  from?: string; // Dhaka YYYY-MM-DD, inclusive
  to?: string; // Dhaka YYYY-MM-DD, inclusive
  page: number;
};

export function noReceiptCutoff(now = new Date()) {
  return new Date(now.getTime() - RECEIPT_GRACE_MS);
}

export async function listRedemptionQueue(f: QueueFilter, now = new Date()) {
  const fromDate = f.from ? dhakaDayStart(f.from) : null;
  const toStart = f.to ? dhakaDayStart(f.to) : null;
  const toDate = toStart ? new Date(toStart.getTime() + 24 * 60 * 60 * 1000) : null; // exclusive end

  const base: Prisma.RedemptionWhereInput = {
    ...(f.branchId ? { branchId: f.branchId } : {}),
    ...(f.partnerId ? { branch: { partnerId: f.partnerId } } : {}),
    ...(fromDate || toDate ? { redeemedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lt: toDate } : {}) } } : {}),
  };
  const flaggedWhere: Prisma.RedemptionWhereInput = { status: "CLAIMED", redeemedAt: { lt: noReceiptCutoff(now) } };
  const where: Prisma.RedemptionWhereInput = f.flagged ? { AND: [base, flaggedWhere] } : { ...base, ...(f.status ? { status: f.status } : {}) };

  const [rows, total, counts, flaggedCount] = await Promise.all([
    db.redemption.findMany({
      where,
      orderBy: [{ redeemedAt: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * QUEUE_PAGE_SIZE,
      take: QUEUE_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        redeemedAt: true,
        billAmount: true,
        discountAmount: true,
        receiptImageKey: true,
        settlementId: true,
        customerId: true,
        branchId: true,
        customer: { select: { email: true, phone: true } },
        branch: { select: { name: true, partner: { select: { name: true } } } },
      },
    }),
    db.redemption.count({ where }),
    db.redemption.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.redemption.count({ where: { AND: [base, flaggedWhere] } }),
  ]);

  const cutoff = noReceiptCutoff(now);
  const signals = await computeFraudSignals(rows);
  return {
    rows: rows.map(({ receiptImageKey, ...r }) => ({
      ...r,
      hasReceipt: !!receiptImageKey,
      flagged: r.status === "CLAIMED" && r.redeemedAt < cutoff,
      signals: signals.get(r.id) ?? [],
    })),
    total,
    pages: Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE)),
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<RedemptionStatus, number>>,
    flaggedCount,
  };
}

export async function listPartnersWithBranches() {
  return db.partner.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, branches: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
}

export async function getRedemptionForStaff(id: string) {
  const r = await db.redemption.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      branchId: true,
      status: true,
      redeemedAt: true,
      reviewedAt: true,
      reviewNote: true,
      billAmount: true,
      discountAmount: true,
      customerPaid: true,
      posReceiptNo: true,
      receiptImageKey: true,
      settlementId: true,
      settlement: { select: { id: true, status: true } },
      verifiedBy: { select: { name: true } },
      customer: { select: { email: true, phone: true } },
      branch: { select: { name: true, area: true, branchCode: true, partner: { select: { id: true, name: true } } } },
      voucher: { select: { offerType: true, value: true, maxDiscount: true, minBill: true, campaign: { select: { name: true } } } },
      smsLogs: { orderBy: { createdAt: "asc" }, select: { purpose: true, status: true, attempt: true, createdAt: true } },
    },
  });
  if (!r) return null;
  const signals = (await computeFraudSignals([r])).get(r.id) ?? [];
  return { ...r, signals };
}
