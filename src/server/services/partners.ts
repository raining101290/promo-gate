import "server-only";

import type { PartnerInput } from "@/lib/schemas/partner";
import { db } from "@/server/db";
import { writeAudit } from "@/server/services/audit";

export async function listPartners() {
  const partners = await db.partner.findMany({
    orderBy: [{ contractStatus: "asc" }, { name: "asc" }],
    include: { branches: { select: { active: true } } },
  });
  return partners.map(({ branches, ...p }) => ({
    ...p,
    branchCount: branches.length,
    activeBranchCount: branches.filter((b) => b.active).length,
  }));
}

export async function getPartnerWithBranches(id: string) {
  return db.partner.findUnique({
    where: { id },
    include: {
      branches: {
        omit: { pinHash: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { _count: { select: { redemptions: true } } },
      },
    },
  });
}

export async function createPartner(input: PartnerInput, staffId: string) {
  return db.$transaction(async (tx) => {
    const partner = await tx.partner.create({ data: input });
    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: "partner.created",
        entityType: "Partner",
        entityId: partner.id,
        meta: { name: input.name, payoutMethod: input.payoutMethod, contractStatus: input.contractStatus },
      },
      tx,
    );
    return partner;
  });
}

export async function updatePartner(id: string, input: PartnerInput, staffId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.partner.findUnique({ where: { id } });
    if (!before) return null;
    const partner = await tx.partner.update({ where: { id }, data: input });

    const changed = (Object.keys(input) as (keyof PartnerInput)[]).filter((k) => before[k] !== input[k]);
    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: before.contractStatus !== input.contractStatus ? "partner.contract_status_changed" : "partner.updated",
        entityType: "Partner",
        entityId: id,
        // Field names only, plus the contract status transition; payout details stay out of the log.
        meta: { changed, contractStatus: { from: before.contractStatus, to: input.contractStatus } },
      },
      tx,
    );
    return partner;
  });
}
