import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { approveSettlement, createDraftSettlement, markSettlementPaid } from "@/server/services/settlements";

import { partnerBranch, redemption, staff } from "../support/factories";

const DAY = 24 * 60 * 60 * 1000;
const period = () => ({ start: new Date(Date.now() - 7 * DAY), end: new Date(Date.now() + DAY) });

describe("settlements", () => {
  it("draft total = sum of VERIFIED, unsettled redemptions of that partner in the period only", async () => {
    const finance = await staff("FINANCE");
    const { partner, branch } = await partnerBranch();
    const other = await partnerBranch();
    const { start, end } = period();
    const included = await Promise.all([
      redemption({ branchId: branch.id, discount: 500_00 }),
      redemption({ branchId: branch.id, discount: 300_50, bill: 1502_50 }),
      redemption({ branchId: branch.id, discount: 200_00 }),
    ]);
    await redemption({ branchId: branch.id, discount: 999_00, redeemedAt: new Date(Date.now() - 30 * DAY) }); // out of period
    await redemption({ branchId: branch.id, discount: 999_00, status: "RECEIPT_UPLOADED" }); // not verified
    await redemption({ branchId: branch.id, discount: 999_00, status: "REJECTED" });
    await redemption({ branchId: other.branch.id, discount: 999_00 }); // other partner

    const r = await createDraftSettlement(partner.id, start, end, finance.id);
    expect(r).toMatchObject({ ok: true, count: 3, totalAmount: 1000_50 });
    if (!r.ok) return;
    const s = await db.settlement.findUniqueOrThrow({ where: { id: r.settlementId }, include: { redemptions: { select: { id: true, discountAmount: true } } } });
    expect(s.totalAmount).toBe(s.redemptions.reduce((n, x) => n + x.discountAmount, 0));
    expect(s.redemptions.map((x) => x.id).sort()).toEqual(included.map((x) => x.id).sort());
    expect(s).toMatchObject({ status: "DRAFT", createdById: finance.id });

    // A redemption can belong to only one settlement.
    expect(await createDraftSettlement(partner.id, start, end, finance.id)).toEqual({ ok: false, reason: "nothing_to_settle" });
  });

  it("concurrent drafts for one partner: one gets everything, the other nothing", async () => {
    const finance = await staff("FINANCE");
    const { partner, branch } = await partnerBranch();
    await Promise.all([1, 2, 3].map(() => redemption({ branchId: branch.id })));
    const { start, end } = period();
    const [a, b] = await Promise.all([createDraftSettlement(partner.id, start, end, finance.id), createDraftSettlement(partner.id, start, end, finance.id)]);
    const ok = [a, b].filter((x) => x.ok);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toMatchObject({ count: 3, totalAmount: 1500_00 });
    expect(await db.settlement.count({ where: { partnerId: partner.id } })).toBe(1);
  });

  it("four-eyes approval, then paid; PAID is final", async () => {
    const [creator, approver] = await Promise.all([staff("FINANCE"), staff("ADMIN")]);
    const { partner, branch } = await partnerBranch();
    await redemption({ branchId: branch.id });
    const { start, end } = period();
    const d = await createDraftSettlement(partner.id, start, end, creator.id);
    if (!d.ok) throw new Error("draft failed");

    expect(await approveSettlement(d.settlementId, creator.id)).toEqual({ ok: false, reason: "same_user" });
    expect(await markSettlementPaid(d.settlementId, "TRX123", creator.id)).toEqual({ ok: false, reason: "wrong_status", status: "DRAFT" });
    expect(await approveSettlement(d.settlementId, approver.id)).toEqual({ ok: true });
    expect(await markSettlementPaid(d.settlementId, "BKX9F2K7QW", creator.id)).toEqual({ ok: true });
    expect(await db.settlement.findUniqueOrThrow({ where: { id: d.settlementId } })).toMatchObject({
      status: "PAID",
      approvedById: approver.id,
      paidById: creator.id,
      paymentRef: "BKX9F2K7QW",
    });
    expect(await markSettlementPaid(d.settlementId, "AGAIN", creator.id)).toEqual({ ok: false, reason: "wrong_status", status: "PAID" });
    expect(await approveSettlement(d.settlementId, approver.id)).toEqual({ ok: false, reason: "wrong_status", status: "PAID" });
    const actions = (await db.auditLog.findMany({ where: { entityId: d.settlementId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["settlement.created", "settlement.approved", "settlement.paid"]);
  });
});
