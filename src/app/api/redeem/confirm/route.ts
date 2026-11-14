import { after, NextResponse } from "next/server";

import { redeemFailureMessage } from "@/lib/redeem-messages";
import { redeemConfirmSchema } from "@/lib/schemas/redeem";
import { getCustomerSession } from "@/server/auth/customer";
import { confirmRedemption, notifyRedemption } from "@/server/services/redemptions";
import { deliverUpmindRedemption } from "@/server/services/upmind";

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, reason: "unauthenticated", error: "Please log in again." }, { status: 401 });

  const parsed = redeemConfirmSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid_input", error: "Invalid request." }, { status: 400 });

  const { voucherId, branchCode, billPaisa, pin } = parsed.data;
  const result = await confirmRedemption(session.sub, voucherId, branchCode, billPaisa, pin);
  if (!result.ok) {
    const status = result.reason === "wrong_pin" ? 401 : result.reason === "voucher_locked" ? 423 : 409;
    return NextResponse.json({ ...result, error: redeemFailureMessage(result) }, { status });
  }
  // Committed. Branch + customer messages run after the response is sent: SMS retries never delay the
  // cashier's success screen, and a gateway failure can't touch the saved redemption.
  after(() => Promise.all([notifyRedemption(result.redemptionId), deliverUpmindRedemption(result.redemptionId)]));
  return NextResponse.json(
    { ok: true, redemptionId: result.redemptionId, redirectTo: `/r/${branchCode}/done/${result.redemptionId}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
