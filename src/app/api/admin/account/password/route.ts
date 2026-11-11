import { NextResponse } from "next/server";

import { changePasswordSchema } from "@/lib/schemas/staff";
import { ALL_STAFF, withStaff } from "@/server/auth/require-role";
import { createSession } from "@/server/auth/session";
import { changeOwnPassword } from "@/server/services/staff";

import { validationError } from "../../validation";
import { staffFailure } from "../../staff/messages";

/** Any staff member changes their own password (also allowed while a forced change is pending). */
export async function POST(req: Request) {
  return withStaff(
    ALL_STAFF,
    async (staff) => {
      const parsed = changePasswordSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return validationError(parsed.error.issues);
      const r = await changeOwnPassword(staff.id, parsed.data.currentPassword, parsed.data.newPassword);
      if (!r.ok) return staffFailure(r);
      // Other devices are now logged out (sessionVersion bumped); keep this browser signed in.
      await createSession({ sub: staff.id, kind: "staff", role: r.role, sv: r.sessionVersion });
      return NextResponse.json({ ok: true, redirectTo: "/admin" });
    },
    { allowPendingPasswordChange: true },
  );
}
