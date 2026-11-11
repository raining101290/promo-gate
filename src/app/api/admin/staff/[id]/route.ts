import { NextResponse } from "next/server";

import { badId, readId } from "@/app/api/id-param";
import { staffUpdateSchema } from "@/lib/schemas/staff";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { updateStaff } from "@/server/services/staff";

import { staffFailure } from "../messages";

/** { name, email, role } (edit; your own role is locked) or { active } (others only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageStaff, async (admin) => {
    const parsed = staffUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.length) ?? parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, error: "Please fix the highlighted fields.", fieldErrors: issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined },
        { status: 400 },
      );
    }
    const id = await readId(params);
    if (!id) return badId();
    const r = await updateStaff(id, parsed.data, admin.id);
    return r.ok ? NextResponse.json({ ok: true }) : staffFailure(r);
  });
}
