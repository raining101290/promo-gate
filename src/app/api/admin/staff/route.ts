import { NextResponse } from "next/server";

import { staffCreateSchema } from "@/lib/schemas/staff";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { createStaff } from "@/server/services/staff";

import { validationError } from "../validation";
import { staffFailure } from "./messages";

/** Admin adds a staff member. The response carries the one-time password exactly once. */
export async function POST(req: Request) {
  return withStaff(PERMISSIONS.manageStaff, async (admin) => {
    const parsed = staffCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const r = await createStaff(parsed.data, admin.id);
    if (!r.ok) return staffFailure(r);
    return NextResponse.json({ ok: true, id: r.id, password: r.password }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
