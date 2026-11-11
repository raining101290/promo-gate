import "server-only";

import type { Prisma, SettlementStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { writeAudit } from "@/server/services/audit";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Ready to pay": verified, not yet in any settlement. */
const READY: Prisma.RedemptionWhereInput = { status: "VERIFIED", settlementId: null };

/** Allowed settlement moves. PAID is final (immutable). */
const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["PAID"],
  PAID: [],
};

/** THE way to change a settlement's status (inside a transaction); conditional, returns true for the winner. */
export async function transitionSettlement(
  tx: Prisma.TransactionClient,
  id: string,
  from: SettlementStatus,
  to: SettlementStatus,
  data: Omit<Prisma.SettlementUncheckedUpdateManyInput, "status"> = {},
  guard: Prisma.SettlementWhereInput = {},
): Promise<boolean> {
  if (!SETTLEMENT_TRANSITIONS[from].includes(to)) throw new Error(`Illegal settlement transition ${from} -> ${to}`);
  const { count } = await tx.settlement.updateMany({ where: { ...guard, id, status: from }, data: { ...data, status: to } });
  return count === 1;
}

/** Ready-to-pay totals per partner (for the settlements overview). */
export async function readyToPayByPartner() {
  const rows = await db.redemption.findMany({
    where: READY,
    select: { discountAmount: true, redeemedAt: true, branch: { select: { partner: { select: { id: true, name: true, contractStatus: true } } } } },
  });
  const by = new Map<string, { partnerId: string; partnerName: string; contractStatus: string; count: number; total: number; oldest: Date; newest: Date }>();
  for (const r of rows) {
    const p = r.branch.partner;
    const cur = by.get(p.id) ?? { partnerId: p.id, partnerName: p.name, contractStatus: p.contractStatus, count: 0, total: 0, oldest: r.redeemedAt, newest: r.redeemedAt };
    cur.count += 1;
    cur.total += r.discountAmount;
    if (r.redeemedAt < cur.oldest) cur.oldest = r.redeemedAt;
    if (r.redeemedAt > cur.newest) cur.newest = r.redeemedAt;
    by.set(p.id, cur);
  }
  return [...by.values()].sort((a, b) => b.total - a.total);
}

export type CreateDraftResult =
  | { ok: true; settlementId: string; count: number; totalAmount: number }
  | { ok: false; reason: "partner_not_found" | "nothing_to_settle" | "bad_period" };

/**
 * Creates a DRAFT settlement for a partner and attaches every ready-to-pay redemption redeemed in
 * [periodStart, periodEnd) (both UTC instants; callers pass Dhaka day boundaries). One transaction:
 * the partner row is locked so concurrent drafts for the same partner serialise, and redemptions are
 * attached with a conditional update (settlementId IS NULL) whose count must match, so a redemption
 * can never end up in two settlements.
 */
export async function createDraftSettlement(partnerId: string, periodStart: Date, periodEnd: Date, staffId: string): Promise<CreateDraftResult> {
  if (!(periodEnd > periodStart)) return { ok: false, reason: "bad_period" };
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Partner" WHERE id = ${partnerId} FOR UPDATE`;
    if (locked.length === 0) return { ok: false, reason: "partner_not_found" } as const;

    const ready = await tx.redemption.findMany({
      where: { ...READY, branch: { partnerId }, redeemedAt: { gte: periodStart, lt: periodEnd } },
      select: { id: true, discountAmount: true },
    });
    if (ready.length === 0) return { ok: false, reason: "nothing_to_settle" } as const;

    const totalAmount = ready.reduce((sum, r) => sum + r.discountAmount, 0);
    const settlement = await tx.settlement.create({
      data: { partnerId, periodStart, periodEnd, totalAmount, status: "DRAFT", createdById: staffId },
      select: { id: true },
    });
    const ids = ready.map((r) => r.id);
    const attached = await tx.redemption.updateMany({ where: { id: { in: ids }, ...READY }, data: { settlementId: settlement.id } });
    if (attached.count !== ids.length) throw new Error("Redemptions changed while creating the settlement; retry");

    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: "settlement.created",
        entityType: "Settlement",
        entityId: settlement.id,
        meta: { partnerId, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), count: ids.length, totalAmount, redemptionIds: ids },
      },
      tx,
    );
    return { ok: true, settlementId: settlement.id, count: ids.length, totalAmount } as const;
  });
}

export type SettlementActionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "same_user" }
  | { ok: false; reason: "wrong_status"; status: SettlementStatus };

/** DRAFT -> APPROVED. Four-eyes: the approver must not be the creator (enforced in the update guard). */
export async function approveSettlement(id: string, staffId: string): Promise<SettlementActionResult> {
  return db.$transaction(async (tx) => {
    const s = await tx.settlement.findUnique({ where: { id }, select: { status: true, createdById: true, totalAmount: true } });
    if (!s) return { ok: false, reason: "not_found" } as const;
    if (s.status !== "DRAFT") return { ok: false, reason: "wrong_status", status: s.status } as const;
    if (s.createdById === staffId) return { ok: false, reason: "same_user" } as const;

    const moved = await transitionSettlement(tx, id, "DRAFT", "APPROVED", { approvedById: staffId, approvedAt: new Date() }, { createdById: { not: staffId } });
    if (!moved) return { ok: false, reason: "wrong_status", status: s.status } as const;
    await writeAudit({ actorType: "STAFF", actorId: staffId, action: "settlement.approved", entityType: "Settlement", entityId: id, meta: { totalAmount: s.totalAmount } }, tx);
    return { ok: true } as const;
  });
}

/** APPROVED -> PAID with the bank/bKash reference. PAID settlements are immutable afterwards. */
export async function markSettlementPaid(id: string, paymentRef: string, staffId: string): Promise<SettlementActionResult> {
  return db.$transaction(async (tx) => {
    const s = await tx.settlement.findUnique({ where: { id }, select: { status: true, totalAmount: true } });
    if (!s) return { ok: false, reason: "not_found" } as const;
    if (s.status !== "APPROVED") return { ok: false, reason: "wrong_status", status: s.status } as const;

    const moved = await transitionSettlement(tx, id, "APPROVED", "PAID", { paymentRef, paidAt: new Date(), paidById: staffId });
    if (!moved) return { ok: false, reason: "wrong_status", status: s.status } as const;
    await writeAudit(
      { actorType: "STAFF", actorId: staffId, action: "settlement.paid", entityType: "Settlement", entityId: id, meta: { totalAmount: s.totalAmount, paymentRef } },
      tx,
    );
    return { ok: true } as const;
  });
}

export async function listSettlements() {
  return db.settlement.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      totalAmount: true,
      createdAt: true,
      paidAt: true,
      partner: { select: { name: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { redemptions: true } },
    },
  });
}

export async function getSettlement(id: string) {
  return db.settlement.findUnique({
    where: { id },
    include: {
      partner: { select: { id: true, name: true, payoutMethod: true, payoutAccount: true, contactName: true, contactPhone: true } },
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { name: true } },
      paidBy: { select: { name: true } },
      redemptions: {
        orderBy: { redeemedAt: "asc" },
        select: { id: true, redeemedAt: true, billAmount: true, discountAmount: true, posReceiptNo: true, branch: { select: { name: true } } },
      },
    },
  });
}

/** Settlement periods are stored as [start, end) UTC instants; the inclusive last Dhaka day is end - 1 day. */
export function periodLastInstant(periodEnd: Date) {
  return new Date(periodEnd.getTime() - DAY_MS);
}
