import { NextResponse } from "next/server";

import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { resetBranchPin } from "@/server/services/branches";
import { badId, readId } from "@/app/api/id-param";

/** Issues a new PIN, returned once. The old PIN stops working immediately. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const id = await readId(params);
    if (!id) return badId();
    const result = await resetBranchPin(id, staff.id);
    if (!result) return NextResponse.json({ ok: false, error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ ok: true, pin: result.pin }, { headers: { "Cache-Control": "no-store" } });
  });
}
