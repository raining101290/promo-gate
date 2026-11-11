import { NextResponse } from "next/server";

import type { StaffFailure } from "@/server/services/staff";

const MESSAGES: Record<StaffFailure["reason"], [number, string]> = {
  not_found: [404, "Staff member not found."],
  email_taken: [409, "A staff member with this email already exists."],
  self: [409, "You can't change your own role, deactivate yourself, or reset your own password here. Use “Change password” for your own."],
  last_admin: [409, "This is the last active admin. Make someone else an admin first."],
  wrong_password: [401, "Your current password is incorrect."],
  rate_limited: [429, "Too many attempts. Try again in 15 minutes."],
  same_as_email: [400, "Don't use your email name in your password."],
};

export function staffFailure(f: StaffFailure) {
  const [status, error] = MESSAGES[f.reason];
  return NextResponse.json({ ok: false, reason: f.reason, error }, { status });
}
