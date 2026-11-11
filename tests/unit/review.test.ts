import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { reviewRedemption } from "@/server/services/redemption-review";

import { partnerBranch, redemption, staff } from "../support/factories";

describe("reviewRedemption without a receipt", () => {
  it("needs a reason, then verifies and records how it was confirmed", async () => {
    const support = await staff("SUPPORT");
    const { branch } = await partnerBranch();
    const r = await redemption({ branchId: branch.id, status: "CLAIMED" });

    expect(await reviewRedemption(r.id, "verify", support.id)).toEqual({ ok: false, reason: "no_receipt" });
    expect((await db.redemption.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CLAIMED");

    const note = "Café confirmed the Hosting.com Voucher payment in its POS records";
    expect(await reviewRedemption(r.id, "verify", support.id, note)).toEqual({ ok: true, status: "VERIFIED" });
    expect(await db.redemption.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: "VERIFIED",
      verifiedById: support.id,
      reviewNote: note,
    });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: r.id, action: "redemption.verified" } });
    expect(audit.meta).toMatchObject({ from: "CLAIMED", withoutReceipt: true, reason: note });
  });

  it("a disputed redemption without a receipt can be verified once the café confirms", async () => {
    const support = await staff("SUPPORT");
    const { branch } = await partnerBranch();
    const r = await redemption({ branchId: branch.id, status: "DISPUTED" });
    expect(await reviewRedemption(r.id, "verify", support.id)).toEqual({ ok: false, reason: "no_receipt" });
    expect(await reviewRedemption(r.id, "verify", support.id, "Café confirmed the sale by phone")).toEqual({ ok: true, status: "VERIFIED" });
  });
});
