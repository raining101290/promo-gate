import { NextResponse } from "next/server";

import { redeemFailureMessage } from "@/lib/redeem-messages";
import { redeemPreviewSchema } from "@/lib/schemas/redeem";
import { getCustomerSession } from "@/server/auth/customer";
import { previewRedemption } from "@/server/services/redemptions";

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, reason: "unauthenticated", error: "Please log in again." }, { status: 401 });

  const parsed = redeemPreviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "invalid_bill", error: "Enter the bill total in taka." }, { status: 400 });

  const { voucherId, branchCode, billPaisa } = parsed.data;
  const result = await previewRedemption(session.sub, voucherId, branchCode, billPaisa);
  if (!result.ok) return NextResponse.json({ ...result, error: redeemFailureMessage(result) }, { status: 409 });
  return NextResponse.json(result);
}
