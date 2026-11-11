import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import type { StaffRole } from "@/generated/prisma/client";
import { readStaffSession } from "@/server/auth/session";
import { db } from "@/server/db";

export type Staff = { id: string; email: string; name: string; role: StaffRole; mustChangePassword: boolean };

export const ALL_STAFF: StaffRole[] = ["SUPPORT", "FINANCE", "ADMIN"];

export class StaffAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "unauthenticated" | "forbidden" | "password_change_required" = status === 401 ? "unauthenticated" : "forbidden",
  ) {
    super(code === "password_change_required" ? "Set a new password first" : status === 401 ? "Not signed in" : "Forbidden");
  }
}

/** Path of the page every staff member can reach, even while a password change is pending. */
export const PASSWORD_PAGE = "/admin/account/password";

/**
 * Current staff member, validated against the DB on every call: a deactivated user, a role change or a
 * revoked session (sessionVersion bumped by a password reset/change or deactivation) takes effect on
 * the very next request, whatever the JWT still says.
 */
export async function getStaff(): Promise<Staff | null> {
  const session = await readStaffSession();
  if (!session) return null;
  const staff = await db.staffUser.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, active: true, mustChangePassword: true, sessionVersion: true },
  });
  if (!staff?.active || staff.sessionVersion !== session.sv) return null;
  return { id: staff.id, email: staff.email, name: staff.name, role: staff.role, mustChangePassword: staff.mustChangePassword };
}

type RequireOpts = { allowPendingPasswordChange?: boolean };

/** For route handlers / server actions. Throws StaffAuthError(401|403); map it with staffAuthErrorResponse. */
export async function requireStaff(roles: readonly StaffRole[] = ALL_STAFF, opts: RequireOpts = {}): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new StaffAuthError(401);
  // A temporary (admin-issued) password only unlocks the change-password page.
  if (staff.mustChangePassword && !opts.allowPendingPasswordChange) throw new StaffAuthError(403, "password_change_required");
  if (!roles.includes(staff.role)) throw new StaffAuthError(403);
  return staff;
}

/** For server components: redirects to login (401), the password page, or the forbidden page (403). */
export async function requireStaffPage(roles: readonly StaffRole[] = ALL_STAFF, nextPath?: string, opts: RequireOpts = {}): Promise<Staff> {
  try {
    return await requireStaff(roles, opts);
  } catch (err) {
    if (!(err instanceof StaffAuthError)) throw err;
    if (err.status === 401) redirect(nextPath ? `/admin/login?next=${encodeURIComponent(nextPath)}` : "/admin/login");
    if (err.code === "password_change_required") redirect(PASSWORD_PAGE);
    redirect("/admin/forbidden");
  }
}

/** Wraps a route handler body: maps StaffAuthError to a JSON 401/403. */
export async function withStaff<T>(
  roles: readonly StaffRole[],
  handler: (staff: Staff) => Promise<T>,
  opts: RequireOpts = {},
): Promise<T | NextResponse> {
  try {
    const staff = await requireStaff(roles, opts);
    return await handler(staff);
  } catch (err) {
    if (err instanceof StaffAuthError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}

/** Who may do what. Pages and route handlers both read from here so the nav and the guards agree. */
export const PERMISSIONS = {
  reviewRequests: ["SUPPORT", "ADMIN"],
  viewRedemptions: ["SUPPORT", "FINANCE", "ADMIN"],
  verifyRedemptions: ["SUPPORT", "ADMIN"],
  viewPartners: ["FINANCE", "ADMIN"],
  managePartners: ["ADMIN"],
  manageCampaigns: ["ADMIN"],
  viewSettlements: ["FINANCE", "ADMIN"],
  manageSettlements: ["FINANCE", "ADMIN"],
  viewAudit: ["ADMIN"],
  /** SMS credit + delivery log (phones masked; no message bodies). */
  viewSms: ["SUPPORT", "FINANCE", "ADMIN"],
  manageStaff: ["ADMIN"],
} as const satisfies Record<string, readonly StaffRole[]>;
