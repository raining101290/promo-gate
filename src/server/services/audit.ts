import "server-only";

import type { ActorType, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type Client = Prisma.TransactionClient | typeof db;

export type AuditEntry = {
  actorType: ActorType;
  /** Customer/StaffUser id, "system", or "anonymous" for unauthenticated attempts */
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Never put OTPs, PINs, tokens or full phone numbers here. */
  meta?: Prisma.InputJsonObject;
};

export async function writeAudit(entry: AuditEntry, client: Client = db): Promise<void> {
  await client.auditLog.create({ data: { ...entry, meta: entry.meta ?? {} } });
}

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilter = {
  action?: string; // exact action or a "prefix." family, e.g. "settlement."
  actorType?: ActorType;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date; // inclusive
  to?: Date; // exclusive
  page: number;
};

/** ADMIN audit viewer. Staff actor names are resolved; customer actors stay as ids. */
export async function listAuditLog(f: AuditFilter) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.action ? (f.action.endsWith(".") ? { action: { startsWith: f.action } } : { action: f.action }) : {}),
    ...(f.actorType ? { actorType: f.actorType } : {}),
    ...(f.actorId ? { actorId: f.actorId } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
    ...(f.entityId ? { entityId: { contains: f.entityId } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
  };
  const [rows, total, actions, entityTypes, staff] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (f.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    db.staffUser.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  return {
    rows: rows.map((r) => ({ ...r, actorName: r.actorType === "STAFF" ? (staffName.get(r.actorId) ?? null) : null })),
    total,
    pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)),
    actions: actions.map((a) => a.action),
    families: [...new Set(actions.map((a) => `${a.action.split(".")[0]}.`))],
    entityTypes: entityTypes.map((e) => e.entityType),
    staff,
  };
}
