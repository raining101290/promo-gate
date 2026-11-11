import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { approveOfferRequest, rejectOfferRequest } from "@/server/services/vouchers";

import { campaign, customer, pendingRequest, staff } from "../support/factories";

const DAY = 24 * 60 * 60 * 1000;

describe("approveOfferRequest", () => {
  it("issues one voucher with snapshotted terms and expiry = now + validityDays", async () => {
    const [s, c, camp] = await Promise.all([staff("SUPPORT"), customer(), campaign({ validityDays: 14 })]);
    const req = await pendingRequest(c.id);
    const t0 = Date.now();
    const r = await approveOfferRequest(req.id, camp.id, s.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = await db.voucher.findUniqueOrThrow({ where: { id: r.voucherId } });
    expect(v).toMatchObject({ status: "ACTIVE", offerType: "FIXED", value: 500_00, faceValue: 500_00, customerId: c.id });
    expect(v.code.length).toBeGreaterThanOrEqual(24);
    expect(Math.abs(v.expiresAt.getTime() - (t0 + 14 * DAY))).toBeLessThan(10_000);
    expect(await db.offerRequest.findUniqueOrThrow({ where: { id: req.id } })).toMatchObject({ status: "APPROVED", reviewedById: s.id });
    expect(await db.auditLog.count({ where: { action: "offer_request.approved", entityId: req.id } })).toBe(1);
  });

  it("unknown request -> not_found", async () => {
    const [s, camp] = await Promise.all([staff("SUPPORT"), campaign()]);
    expect(await approveOfferRequest("does_not_exist", camp.id, s.id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("already reviewed (approved or rejected) -> already_reviewed", async () => {
    const [s, c, camp] = await Promise.all([staff("SUPPORT"), customer(), campaign()]);
    const a = await pendingRequest(c.id);
    await approveOfferRequest(a.id, camp.id, s.id);
    expect(await approveOfferRequest(a.id, camp.id, s.id)).toEqual({ ok: false, reason: "already_reviewed", status: "APPROVED" });
    const b = await pendingRequest(c.id);
    await rejectOfferRequest(b.id, "Invoice is not paid yet", s.id);
    expect(await approveOfferRequest(b.id, camp.id, s.id)).toEqual({ ok: false, reason: "already_reviewed", status: "REJECTED" });
  });

  it("10 concurrent approvals of one request -> exactly one voucher", async () => {
    const [s, c, camp1, camp2] = await Promise.all([staff("SUPPORT"), customer(), campaign(), campaign()]);
    const req = await pendingRequest(c.id);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => approveOfferRequest(req.id, i % 2 ? camp1.id : camp2.id, s.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "already_reviewed")).toHaveLength(9);
    expect(await db.voucher.count({ where: { offerRequestId: req.id } })).toBe(1);
  });

  it.each([
    ["inactive", { active: false }, "campaign_inactive"],
    ["not started", { startsAt: new Date(Date.now() + DAY) }, "campaign_not_started"],
    ["ended", { endsAt: new Date(Date.now() - 1000) }, "campaign_ended"],
  ] as const)("campaign %s -> %s, request stays PENDING", async (_l, over, reason) => {
    const [s, c, camp] = await Promise.all([staff("SUPPORT"), customer(), campaign(over)]);
    const req = await pendingRequest(c.id);
    expect(await approveOfferRequest(req.id, camp.id, s.id)).toEqual({ ok: false, reason });
    expect((await db.offerRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("PENDING");
  });

  it("budget: blocks the approval that would exceed totalBudget (percent counts maxDiscount)", async () => {
    const s = await staff("SUPPORT");
    const camp = await campaign({ offerType: "PERCENT", value: 2000, maxDiscount: 300_00, totalBudget: 600_00 });
    const reqs = await Promise.all([customer(), customer(), customer()].map(async (p) => pendingRequest((await p).id)));
    expect((await approveOfferRequest(reqs[0].id, camp.id, s.id)).ok).toBe(true);
    expect((await approveOfferRequest(reqs[1].id, camp.id, s.id)).ok).toBe(true);
    expect(await approveOfferRequest(reqs[2].id, camp.id, s.id)).toEqual({ ok: false, reason: "budget_exceeded", remaining: 0, needed: 300_00 });
  });

  it("per-customer limit", async () => {
    const [s, c, camp] = await Promise.all([staff("SUPPORT"), customer(), campaign({ perCustomerLimit: 1 })]);
    const [a, b] = [await pendingRequest(c.id), await pendingRequest(c.id)];
    expect((await approveOfferRequest(a.id, camp.id, s.id)).ok).toBe(true);
    expect(await approveOfferRequest(b.id, camp.id, s.id)).toEqual({ ok: false, reason: "customer_limit_reached", limit: 1 });
  });
});
