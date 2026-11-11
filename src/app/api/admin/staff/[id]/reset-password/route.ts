import { NextResponse } from "next/server";

import { badId, readId } from "@/app/api/id-param";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { resetStaffPassword } from "@/server/services/staff";

import { staffFailure } from "../../messages";

/** New one-time password for someone else (returned once); their existing sessions end. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageStaff, async (admin) => {
    const id = await readId(params);
    if (!id) return badId();
    const r = await resetStaffPassword(id, admin.id);
    return r.ok ? NextResponse.json({ ok: true, password: r.password }, { headers: { "Cache-Control": "no-store" } }) : staffFailure(r);
  });
}
