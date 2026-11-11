import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { confirmRedemption, previewRedemption } from "@/server/services/redemptions";

import { customer, partnerBranch, voucher } from "../support/factories";

async function setup(o: Parameters<typeof partnerBranch>[0] = {}) {
  const c = await customer();
  const { branch } = await partnerBranch(o);
  const v = await voucher({ customerId: c.id });
  return { c, branch, v };
}

describe("confirmRedemption", () => {
  it("happy path: voucher REDEEMED, Redemption CLAIMED with paisa amounts", async () => {
    const { c, branch, v } = await setup();
    const r = await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await db.redemption.findUniqueOrThrow({ where: { id: r.redemptionId } })).toMatchObject({
      status: "CLAIMED",
      billAmount: 1000_00,
      discountAmount: 500_00,
      customerPaid: 500_00,
      branchId: branch.id,
      customerId: c.id,
    });
    expect((await db.voucher.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("REDEEMED");
  });

  it("expired voucher -> voucher_expired, nothing written", async () => {
    const c = await customer();
    const { branch } = await partnerBranch();
    const v = await voucher({ customerId: c.id, expiresAt: new Date(Date.now() - 60_000) });
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")).toEqual({ ok: false, reason: "voucher_expired" });
    expect(await db.redemption.count({ where: { voucherId: v.id } })).toBe(0);
  });

  it("someone else's voucher -> voucher_not_found (indistinguishable from missing)", async () => {
    const { branch, v } = await setup();
    const intruder = await customer();
    expect(await confirmRedemption(intruder.id, v.id, branch.branchCode, 1000_00, "1234")).toEqual({ ok: false, reason: "voucher_not_found" });
    expect((await db.voucher.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("ACTIVE");
  });

  it.each([
    ["inactive branch", { active: false }],
    ["paused partner", { contractStatus: "PAUSED" as const }],
    ["ended partner", { contractStatus: "ENDED" as const }],
  ])("%s -> branch_unavailable", async (_l, o) => {
    const { c, branch, v } = await setup(o);
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")).toEqual({ ok: false, reason: "branch_unavailable" });
  });

  it("below the voucher's minBill -> rejected before the PIN is even checked", async () => {
    const c = await customer();
    const { branch } = await partnerBranch();
    const v = await voucher({ customerId: c.id, terms: { offerType: "PERCENT", value: 2000, maxDiscount: 300_00, minBill: 500_00 } });
    expect(await previewRedemption(c.id, v.id, branch.branchCode, 400_00)).toEqual({ ok: false, reason: "below_min_bill", minBill: 500_00 });
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 400_00, "0000")).toEqual({ ok: false, reason: "below_min_bill", minBill: 500_00 });
  });

  it("PIN lockout: 4 wrong -> attempts left 4..1, 5th locks, then even the correct PIN is refused", async () => {
    const { c, branch, v } = await setup();
    const left: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "9999");
      if (!r.ok && r.reason === "wrong_pin") left.push(r.attemptsLeft);
    }
    expect(left).toEqual([4, 3, 2, 1]);
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "9999")).toMatchObject({ ok: false, reason: "voucher_locked" });
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")).toMatchObject({ ok: false, reason: "voucher_locked" });
    const locked = await db.voucher.findUniqueOrThrow({ where: { id: v.id } });
    expect(locked.status).toBe("ACTIVE");
    expect(locked.pinLockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(await db.auditLog.count({ where: { action: "voucher.pin_locked", entityId: v.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "voucher.pin_failed", entityId: branch.id } })).toBe(5);
  });

  it("double submit: 8 parallel confirms -> exactly one Redemption", async () => {
    const { c, branch, v } = await setup();
    const results = await Promise.all(Array.from({ length: 8 }, () => confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const r of results.filter((x) => !x.ok)) expect(["already_redeemed", "voucher_not_active"]).toContain((r as { reason: string }).reason);
    expect(await db.redemption.count({ where: { voucherId: v.id } })).toBe(1);
  });

  it("a redeemed voucher can't be used again (sequential retry)", async () => {
    const { c, branch, v } = await setup();
    expect((await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")).ok).toBe(true);
    expect(await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234")).toEqual({ ok: false, reason: "voucher_not_active", status: "REDEEMED" });
  });
});
