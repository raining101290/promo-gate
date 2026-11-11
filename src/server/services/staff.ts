import "server-only";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { Prisma, type StaffRole } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";

const BCRYPT_COST = 12;
/** 16 url-safe characters (~96 bits). Shown once; the user must replace it at first login. */
const tempPassword = () => randomBytes(12).toString("base64url");

export type StaffFailure = {
  ok: false;
  reason: "not_found" | "email_taken" | "self" | "last_admin" | "wrong_password" | "rate_limited" | "same_as_email";
};

export async function listStaff() {
  return db.staffUser.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: { id: true, email: true, name: true, role: true, active: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
  });
}

/** New staff account with a one-time password (returned once, never stored in plaintext). */
export async function createStaff(input: { email: string; name: string; role: StaffRole }, actorId: string) {
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const staff = await db.$transaction(async (tx) => {
      const created = await tx.staffUser.create({ data: { ...input, passwordHash, mustChangePassword: true }, select: { id: true } });
      await writeAudit({ actorType: "STAFF", actorId, action: "staff.created", entityType: "StaffUser", entityId: created.id, meta: { email: input.email, role: input.role } }, tx);
      return created;
    });
    return { ok: true as const, id: staff.id, password };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { ok: false as const, reason: "email_taken" as const };
    throw err;
  }
}

export type StaffEdit = { name: string; email: string; role: StaffRole };

/**
 * Edit details (name, email, role) or flip the active flag. Guards, in one transaction with all admin
 * rows locked (so two admins can't demote each other at the same moment):
 * - yourself: you may edit your own name/email, but not your own role or active flag;
 * - the last active ADMIN can't be demoted or deactivated;
 * - emails are unique.
 * Deactivation bumps sessionVersion (signs them out everywhere). Role/name/email apply on their next click.
 */
export async function updateStaff(id: string, change: StaffEdit | { active: boolean }, actorId: string) {
  const isSelf = id === actorId;
  if (isSelf && "active" in change) return { ok: false as const, reason: "self" as const };
  try {
    return await db.$transaction(async (tx) => {
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "StaffUser" WHERE role = 'ADMIN' AND active FOR UPDATE`;
      const target = await tx.staffUser.findUnique({ where: { id }, select: { name: true, email: true, role: true, active: true } });
      if (!target) return { ok: false as const, reason: "not_found" as const };

      if ("active" in change) {
        if (target.role === "ADMIN" && target.active && !change.active && admins.length <= 1) return { ok: false as const, reason: "last_admin" as const };
        await tx.staffUser.update({ where: { id }, data: { active: change.active, ...(change.active ? {} : { sessionVersion: { increment: 1 } }) } });
        await writeAudit({ actorType: "STAFF", actorId, action: change.active ? "staff.activated" : "staff.deactivated", entityType: "StaffUser", entityId: id }, tx);
        return { ok: true as const };
      }

      const roleChanged = change.role !== target.role;
      if (isSelf && roleChanged) return { ok: false as const, reason: "self" as const };
      if (roleChanged && target.role === "ADMIN" && target.active && admins.length <= 1) return { ok: false as const, reason: "last_admin" as const };

      const changed: Record<string, { from: string; to: string }> = {};
      for (const k of ["name", "email", "role"] as const) if (change[k] !== target[k]) changed[k] = { from: target[k], to: change[k] };
      if (Object.keys(changed).length === 0) return { ok: true as const };

      await tx.staffUser.update({ where: { id }, data: { name: change.name, email: change.email, role: change.role } });
      await writeAudit(
        { actorType: "STAFF", actorId, action: roleChanged ? "staff.role_changed" : "staff.updated", entityType: "StaffUser", entityId: id, meta: changed },
        tx,
      );
      return { ok: true as const };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { ok: false as const, reason: "email_taken" as const };
    throw err;
  }
}

/** Admin resets someone else's password: new one-time password, forced change, all their sessions end. */
export async function resetStaffPassword(id: string, actorId: string) {
  if (id === actorId) return { ok: false as const, reason: "self" as const };
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  return db.$transaction(async (tx) => {
    const updated = await tx.staffUser.updateMany({
      where: { id },
      data: { passwordHash, mustChangePassword: true, sessionVersion: { increment: 1 } },
    });
    if (updated.count === 0) return { ok: false as const, reason: "not_found" as const };
    await writeAudit({ actorType: "STAFF", actorId, action: "staff.password_reset", entityType: "StaffUser", entityId: id }, tx);
    return { ok: true as const, password };
  });
}

/**
 * Staff member changes their own password. Ends every other session (sessionVersion++) and returns the
 * new version so the caller can re-issue the current browser's cookie.
 */
export async function changeOwnPassword(staffId: string, currentPassword: string, newPassword: string) {
  if (!(await limit("passwordChange", staffId)).allowed) return { ok: false as const, reason: "rate_limited" as const };
  const staff = await db.staffUser.findUnique({ where: { id: staffId }, select: { email: true, passwordHash: true, role: true } });
  if (!staff) return { ok: false as const, reason: "not_found" as const };
  if (!(await bcrypt.compare(currentPassword, staff.passwordHash))) {
    await writeAudit({ actorType: "STAFF", actorId: staffId, action: "staff.password_change_failed", entityType: "StaffUser", entityId: staffId });
    return { ok: false as const, reason: "wrong_password" as const };
  }
  if (newPassword.toLowerCase().includes(staff.email.split("@")[0].toLowerCase())) return { ok: false as const, reason: "same_as_email" as const };

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.staffUser.update({
      where: { id: staffId },
      data: {
        passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
      select: { sessionVersion: true, role: true },
    });
    await writeAudit({ actorType: "STAFF", actorId: staffId, action: "staff.password_changed", entityType: "StaffUser", entityId: staffId }, tx);
    return u;
  });
  return { ok: true as const, sessionVersion: updated.sessionVersion, role: updated.role };
}
