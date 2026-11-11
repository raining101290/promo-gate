import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { changeOwnPassword, createStaff, resetStaffPassword, updateStaff } from "@/server/services/staff";

import { staff, uid } from "../support/factories";

const get = (id: string) => db.staffUser.findUniqueOrThrow({ where: { id } });
/** Full edit payload = current details with some fields changed. */
const edit = (s: { name: string; email: string; role: "SUPPORT" | "FINANCE" | "ADMIN" }, over: Partial<{ name: string; email: string; role: "SUPPORT" | "FINANCE" | "ADMIN" }>) => ({
  name: s.name,
  email: s.email,
  role: s.role,
  ...over,
});

describe("staff management", () => {
  it("createStaff: one-time password, only its hash stored, forced change; duplicate email refused", async () => {
    const admin = await staff("ADMIN");
    const email = `new-${uid()}@test.local`;
    const r = await createStaff({ email, name: "New Agent", role: "SUPPORT" }, admin.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await get(r.id);
    expect(s.passwordHash).not.toContain(r.password);
    expect(await bcrypt.compare(r.password, s.passwordHash)).toBe(true);
    expect(s).toMatchObject({ role: "SUPPORT", active: true, mustChangePassword: true });
    expect(await createStaff({ email, name: "Dup", role: "FINANCE" }, admin.id)).toEqual({ ok: false, reason: "email_taken" });
    expect(await db.auditLog.count({ where: { action: "staff.created", entityId: r.id, actorId: admin.id } })).toBe(1);
  });

  it("yourself: name/email editable, role/active/reset are not", async () => {
    const admin = await staff("ADMIN");
    expect(await updateStaff(admin.id, edit(admin, { role: "SUPPORT" }), admin.id)).toEqual({ ok: false, reason: "self" });
    expect(await updateStaff(admin.id, { active: false }, admin.id)).toEqual({ ok: false, reason: "self" });
    expect(await resetStaffPassword(admin.id, admin.id)).toEqual({ ok: false, reason: "self" });
    expect(await updateStaff(admin.id, edit(admin, { name: "Renamed Admin" }), admin.id)).toEqual({ ok: true });
    expect((await get(admin.id)).name).toBe("Renamed Admin");
  });

  it("edit name/email/role of someone else; duplicate email refused; audited with from/to", async () => {
    const admin = await staff("ADMIN");
    const [a, b] = [await staff("SUPPORT"), await staff("SUPPORT")];
    const newEmail = `moved-${uid()}@test.local`;
    expect(await updateStaff(a.id, { name: "Agent A", email: newEmail, role: "FINANCE" }, admin.id)).toEqual({ ok: true });
    expect(await get(a.id)).toMatchObject({ name: "Agent A", email: newEmail, role: "FINANCE", sessionVersion: 0 });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: a.id, action: "staff.role_changed" } });
    expect(audit.meta).toMatchObject({ role: { from: "SUPPORT", to: "FINANCE" }, email: { to: newEmail } });
    expect(await updateStaff(b.id, edit(b, { email: newEmail }), admin.id)).toEqual({ ok: false, reason: "email_taken" });
  });

  it("the last active admin can't be demoted or deactivated", async () => {
    await db.staffUser.updateMany({ where: { role: "ADMIN" }, data: { active: false } }); // isolate (test DB)
    const [a, b] = [await staff("ADMIN"), await staff("ADMIN")];
    expect(await updateStaff(b.id, edit(b, { role: "FINANCE" }), a.id)).toEqual({ ok: true }); // 2 admins -> fine
    expect(await updateStaff(a.id, edit(a, { role: "SUPPORT" }), b.id)).toEqual({ ok: false, reason: "last_admin" });
    expect(await updateStaff(a.id, { active: false }, b.id)).toEqual({ ok: false, reason: "last_admin" });
    expect((await get(a.id)).role).toBe("ADMIN");
  });

  it("deactivating and resetting a password end that person's sessions (sessionVersion++)", async () => {
    const admin = await staff("ADMIN");
    const agent = await staff("SUPPORT");
    const v0 = (await get(agent.id)).sessionVersion;
    const reset = await resetStaffPassword(agent.id, admin.id);
    expect(reset.ok).toBe(true);
    const afterReset = await get(agent.id);
    expect(afterReset).toMatchObject({ sessionVersion: v0 + 1, mustChangePassword: true });
    expect(await updateStaff(agent.id, { active: false }, admin.id)).toEqual({ ok: true });
    expect(await get(agent.id)).toMatchObject({ active: false, sessionVersion: v0 + 2 });
    const roleOnly = await staff("FINANCE");
    await updateStaff(roleOnly.id, edit(roleOnly, { role: "SUPPORT" }), admin.id);
    expect((await get(roleOnly.id)).sessionVersion).toBe(0); // role changes apply live, no logout needed
  });

  it("changeOwnPassword: wrong current refused; success clears the forced change and bumps the version", async () => {
    const admin = await staff("ADMIN");
    const agent = await staff("SUPPORT");
    const reset = await resetStaffPassword(agent.id, admin.id);
    if (!reset.ok) throw new Error("reset failed");
    expect(await changeOwnPassword(agent.id, "not-the-password", "a brand new long password")).toEqual({ ok: false, reason: "wrong_password" });
    const ok = await changeOwnPassword(agent.id, reset.password, "a brand new long password");
    expect(ok).toMatchObject({ ok: true, sessionVersion: 2 });
    const s = await get(agent.id);
    expect(s.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("a brand new long password", s.passwordHash)).toBe(true);
    expect(await bcrypt.compare(reset.password, s.passwordHash)).toBe(false);
  });
});
