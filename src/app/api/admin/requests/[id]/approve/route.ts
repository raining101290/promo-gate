import { NextResponse } from "next/server";

import { approveSchema } from "@/lib/schemas/staff";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { approveOfferRequest } from "@/server/services/vouchers";

import { reviewFailureResponse } from "../../review-response";
import { badId, readId } from "@/app/api/id-param";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.reviewRequests, async (staff) => {
    const parsed = approveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const id = await readId(params);
    if (!id) return badId();
    const result = await approveOfferRequest(id, parsed.data.campaignId, staff.id);
    if (!result.ok) return reviewFailureResponse(result);
    return NextResponse.json({ ok: true, voucherId: result.voucherId, expiresAt: result.expiresAt });
  });
}
