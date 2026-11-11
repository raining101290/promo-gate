import { NextResponse } from "next/server";

import { formatRejectReason, rejectSchema } from "@/lib/schemas/staff";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { rejectOfferRequest } from "@/server/services/vouchers";

import { reviewFailureResponse } from "../../review-response";
import { badId, readId } from "@/app/api/id-param";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.reviewRequests, async (staff) => {
    const parsed = rejectSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0] },
        { status: 400 },
      );
    }
    const id = await readId(params);
    if (!id) return badId();
    const reason = formatRejectReason(parsed.data.reasonCode, parsed.data.note);
    const result = await rejectOfferRequest(id, reason, staff.id);
    if (!result.ok) return reviewFailureResponse(result);
    return NextResponse.json({ ok: true });
  });
}
