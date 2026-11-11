import { NextResponse } from "next/server";

import { reviewRedemptionSchema } from "@/lib/schemas/settlement";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { reviewRedemption } from "@/server/services/redemption-review";
import { badId, readId } from "@/app/api/id-param";

const MESSAGES = {
  not_found: [404, "Redemption not found."],
  no_receipt: [409, "There's no receipt to verify yet. Dispute or reject it instead, or wait for the customer."],
  in_settlement: [409, "This redemption is already in a settlement and can't be changed."],
  wrong_status: [409, "This redemption was already reviewed. Refresh to see its current status."],
} as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.verifyRedemptions, async (staff) => {
    const parsed = reviewRedemptionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    const id = await readId(params);
    if (!id) return badId();
    const r = await reviewRedemption(id, parsed.data.action, staff.id, parsed.data.reason);
    if (!r.ok) {
      const [status, error] = MESSAGES[r.reason];
      return NextResponse.json({ ok: false, reason: r.reason, error }, { status });
    }
    return NextResponse.json({ ok: true, status: r.status });
  });
}
