import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/integrations/upmind/vouchers/route";
import { db } from "@/server/db";
import { confirmRedemption } from "@/server/services/redemptions";
import { deliverUpmind, deliverUpmindRedemption, UPMIND_RETRY_MINUTES, validatedCodeFor } from "@/server/services/upmind";

import { campaign, customer, partnerBranch, uid, voucher } from "../support/factories";

const SECRET = "test-upmind-secret-0123456789abcdef0123456789";

beforeAll(async () => {
  process.env.UPMIND_SECRET = SECRET;
  process.env.UPMIND_REDEMPTION_URL = "https://upmind.example/hooks/coffee";
  // Exactly one auto-issue campaign for this file.
  await db.campaign.updateMany({ where: { autoIssue: true }, data: { autoIssue: false } });
  await campaign({ value: 500_00, minBill: 400_00 }).then((c) => db.campaign.update({ where: { id: c.id }, data: { autoIssue: true } }));
});
afterEach(() => vi.unstubAllGlobals());

const phone = () => `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

function body(over: Partial<{ customerName: string; email: string; phone: string; invoiceNumber: string; validatedCode: string }> = {}) {
  const b = { customerName: "Tahmid Ahmed", email: `t-${uid()}@example.com`, phone: phone(), invoiceNumber: `INV-${uid()}`.toUpperCase(), ...over };
  return { ...b, validatedCode: over.validatedCode ?? validatedCodeFor(SECRET, b.invoiceNumber, b.email) };
}

async function push(b: object) {
  const res = await POST(new Request("http://localhost/api/integrations/upmind/vouchers", { method: "POST", body: JSON.stringify(b) }));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

describe("Upmind pushes a paid invoice", () => {
  it("issues a voucher from the auto-issue campaign, creates the customer, sends no email of ours", async () => {
    const b = body();
    const { status, json } = await push(b);
    expect(status).toBe(201);
    expect(json).toMatchObject({ status: "issued", invoiceNumber: b.invoiceNumber, voucher: { offer: "৳500 off" } });

    const req = await db.offerRequest.findUniqueOrThrow({ where: { invoiceNumber: b.invoiceNumber }, include: { voucher: true, customer: true } });
    expect(req).toMatchObject({ source: "UPMIND", status: "APPROVED", reviewedById: null, customerName: "Tahmid Ahmed", upmindCode: b.validatedCode });
    expect(req.customer).toMatchObject({ email: b.email, phone: `+88${b.phone}`, name: "Tahmid Ahmed" });
    expect(req.voucher).toMatchObject({ status: "ACTIVE", faceValue: 500_00 });
    expect(await db.emailLog.count({ where: { toEmail: b.email } })).toBe(0);
    expect(await db.upmindInbound.findFirst({ where: { invoiceNumber: b.invoiceNumber } })).toMatchObject({ outcome: "issued", httpStatus: 201 });
  });

  it("is idempotent: the same push again returns the same voucher (200), nothing new", async () => {
    const b = body();
    await push(b);
    const again = await push(b);
    expect(again.status).toBe(200);
    expect(again.json.status).toBe("already_issued");
    expect(await db.voucher.count({ where: { offerRequest: { invoiceNumber: b.invoiceNumber } } })).toBe(1);
  });

  it("refuses a wrong validatedCode (401) and an invoice reused with another email (409)", async () => {
    expect((await push(body({ validatedCode: "0".repeat(64) }))).status).toBe(401);
    const b = body();
    await push(b);
    const other = body({ invoiceNumber: b.invoiceNumber });
    const r = await push(other);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("invoice_used");
  });

  it("validates fields: missing → 400, non-BD phone → 422", async () => {
    expect((await push({ email: "a@b.c" })).status).toBe(400);
    const r = await push(body({ phone: "+14155550100" }));
    expect(r.status).toBe(422);
    expect(r.json.fields).toEqual(["phone"]);
  });

  it("existing customer by email: voucher goes to them, their contacts are not changed", async () => {
    const c = await customer();
    const b = body({ email: c.email, phone: phone() });
    expect((await push(b)).status).toBe(201);
    const after = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.phone).toBe(c.phone);
    expect(await db.voucher.count({ where: { customerId: c.id } })).toBe(1);
  });

  it("phone owned by another account and email unknown → waits for support (202), no voucher", async () => {
    const c = await customer();
    const b = body({ phone: c.phone.replace("+88", "") });
    const r = await push(b);
    expect(r.status).toBe(202);
    expect(r.json).toMatchObject({ status: "pending_review", reason: "contact_conflict" });
    expect(await db.offerRequest.findUniqueOrThrow({ where: { invoiceNumber: b.invoiceNumber } })).toMatchObject({ status: "PENDING", source: "UPMIND" });
  });

  it("no auto-issue campaign → waits for support (202)", async () => {
    const marked = await db.campaign.findFirstOrThrow({ where: { autoIssue: true } });
    await db.campaign.update({ where: { id: marked.id }, data: { autoIssue: false } });
    try {
      const r = await push(body());
      expect(r.status).toBe(202);
      expect(r.json.reason).toBe("no_auto_campaign");
    } finally {
      await db.campaign.update({ where: { id: marked.id }, data: { autoIssue: true } });
    }
  });
});

describe("redemption callback to Upmind", () => {
  async function redeemUpmindVoucher() {
    const b = body();
    await push(b);
    const req = await db.offerRequest.findUniqueOrThrow({ where: { invoiceNumber: b.invoiceNumber }, include: { voucher: true } });
    const { branch, partner } = await partnerBranch();
    const r = await confirmRedemption(req.customerId, req.voucher!.id, branch.branchCode, 1000_00, "1234");
    if (!r.ok) throw new Error(r.reason);
    return { b, redemptionId: r.redemptionId, branch, partner };
  }

  it("is queued in the redeem transaction and sent with the agreed payload", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("{}", { status: 200 });
      }),
    );
    const { b, redemptionId, branch, partner } = await redeemUpmindVoucher();
    await deliverUpmindRedemption(redemptionId);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://upmind.example/hooks/coffee");
    expect(calls[0].body).toEqual({
      event: "voucher.redeemed",
      invoiceNumber: b.invoiceNumber,
      validatedCode: b.validatedCode,
      redemption: {
        reference: expect.stringMatching(/^R-[A-Z0-9]{6}$/),
        redeemedAt: expect.stringMatching(/Z$/),
        cafe: partner.name,
        branch: branch.name,
        branchCode: branch.branchCode,
        currency: "BDT",
        billAmount: "1000.00",
        discountAmount: "500.00",
        customerPaid: "500.00",
      },
      voucher: { offer: "৳500 off" },
    });
    expect(await db.upmindDelivery.findUniqueOrThrow({ where: { redemptionId } })).toMatchObject({ status: "SENT", attempts: 1, lastStatus: 200 });
  });

  it("retries on failure with backoff, then gives up as FAILED", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("maintenance", { status: 503 })));
    const { redemptionId } = await redeemUpmindVoucher();
    await deliverUpmindRedemption(redemptionId);
    let row = await db.upmindDelivery.findUniqueOrThrow({ where: { redemptionId } });
    expect(row).toMatchObject({ status: "PENDING", attempts: 1, lastStatus: 503 });
    expect(row.lastError).toContain("HTTP 503");
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50_000); // ~1 minute later

    for (let i = 1; i < UPMIND_RETRY_MINUTES.length + 1; i++) {
      await db.upmindDelivery.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(0) } });
      await deliverUpmind(row.id);
    }
    row = await db.upmindDelivery.findUniqueOrThrow({ where: { redemptionId } });
    expect(row).toMatchObject({ status: "FAILED", attempts: UPMIND_RETRY_MINUTES.length + 1 });
  });

  it("vouchers from the invoice form don't call Upmind", async () => {
    const c = await customer();
    const v = await voucher({ customerId: c.id });
    const { branch } = await partnerBranch();
    const r = await confirmRedemption(c.id, v.id, branch.branchCode, 1000_00, "1234");
    expect(r.ok).toBe(true);
    if (r.ok) expect(await db.upmindDelivery.findUnique({ where: { redemptionId: r.redemptionId } })).toBeNull();
  });
});
