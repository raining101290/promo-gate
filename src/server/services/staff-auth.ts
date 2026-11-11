import "server-only";

import bcrypt from "bcryptjs";

import { maskEmail } from "@/lib/phone";
import type { StaffRole } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";


// Compared against when the email is unknown so response time doesn't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type StaffLoginResult =
  | { ok: true; staff: { id: string; role: StaffRole; sessionVersion: number; mustChangePassword: boolean } }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export async function authenticateStaff(email: string, password: string, ip: string): Promise<StaffLoginResult> {
  const rl = await limit("staffLogin", `${ip}:${email}`);
  if (!rl.allowed) return { ok: false, reason: "rate_limited", retryAfterSeconds: rl.retryAfterSeconds };

  const staff = await db.staffUser.findUnique({
    where: { email },
    select: { id: true, role: true, active: true, passwordHash: true, sessionVersion: true, mustChangePassword: true },
  });
  const passwordOk = await bcrypt.compare(password, staff?.passwordHash ?? DUMMY_HASH);
  const ok = !!staff && staff.active && passwordOk;

  await writeAudit({
    actorType: "STAFF",
    actorId: ok ? staff.id : "anonymous",
    action: ok ? "staff.login.success" : "staff.login.failure",
    entityType: "StaffUser",
    entityId: staff?.id ?? "unknown",
    meta: { email: maskEmail(email), ...(ok ? {} : { reason: !staff ? "unknown_email" : !staff.active ? "inactive" : "bad_password" }) },
  });

  if (!ok) return { ok: false, reason: "invalid" };
  await db.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
  return { ok: true, staff: { id: staff.id, role: staff.role, sessionVersion: staff.sessionVersion, mustChangePassword: staff.mustChangePassword } };
}
