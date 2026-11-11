import "server-only";

import type { CampaignInput } from "@/lib/schemas/campaign";
import { db } from "@/server/db";
import { writeAudit } from "@/server/services/audit";

// Campaign edits never change issued vouchers: vouchers carry a snapshot of the terms.

export async function listCampaignsWithUsage() {
  const [campaigns, usage] = await Promise.all([
    db.campaign.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    db.voucher.groupBy({
      by: ["campaignId"],
      where: { status: { not: "VOID" } },
      _sum: { faceValue: true },
      _count: { _all: true },
    }),
  ]);
  // Redeemed value = voucher amounts actually used at cafés (rejected redemptions excluded).
  const redeemed = await db.$queryRaw<{ campaignId: string; redeemed: bigint; count: bigint }[]>`
    SELECT v."campaignId", COALESCE(SUM(r."discountAmount"), 0) AS redeemed, COUNT(*) AS count
    FROM "Redemption" r JOIN "Voucher" v ON v.id = r."voucherId"
    WHERE r.status <> 'REJECTED'
    GROUP BY v."campaignId"`;
  const redeemedById = new Map(redeemed.map((r) => [r.campaignId, { redeemed: Number(r.redeemed), redeemedCount: Number(r.count) }]));
  const byId = new Map(usage.map((u) => [u.campaignId, { issued: u._count._all, committed: u._sum.faceValue ?? 0 }]));
  return campaigns.map((c) => ({
    ...c,
    ...(byId.get(c.id) ?? { issued: 0, committed: 0 }),
    ...(redeemedById.get(c.id) ?? { redeemed: 0, redeemedCount: 0 }),
  }));
}

/** Active campaigns that can issue a voucher right now (for the approve panel). */
export async function listIssuableCampaigns(now: Date = new Date()) {
  const all = await listCampaignsWithUsage();
  return all.filter((c) => c.active && c.startsAt <= now && (!c.endsAt || c.endsAt > now));
}

export async function getCampaign(id: string) {
  return db.campaign.findUnique({ where: { id } });
}

/** New campaigns start inactive; an admin activates them explicitly. */
export async function createCampaign(input: CampaignInput, staffId: string) {
  return db.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({ data: { ...input, active: false } });
    await writeAudit(
      { actorType: "STAFF", actorId: staffId, action: "campaign.created", entityType: "Campaign", entityId: campaign.id, meta: auditMeta(input) },
      tx,
    );
    return campaign;
  });
}

export async function updateCampaign(id: string, input: CampaignInput, staffId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id } });
    if (!before) return null;
    const campaign = await tx.campaign.update({ where: { id }, data: input });
    await writeAudit(
      {
        actorType: "STAFF",
        actorId: staffId,
        action: "campaign.updated",
        entityType: "Campaign",
        entityId: id,
        meta: { before: auditMeta(before), after: auditMeta(input) },
      },
      tx,
    );
    return campaign;
  });
}

export async function setCampaignActive(id: string, active: boolean, staffId: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.campaign.updateMany({ where: { id }, data: { active } });
    if (updated.count === 0) return null;
    await writeAudit(
      { actorType: "STAFF", actorId: staffId, action: active ? "campaign.activated" : "campaign.deactivated", entityType: "Campaign", entityId: id },
      tx,
    );
    return { id, active };
  });
}

function auditMeta(c: CampaignInput) {
  return {
    name: c.name,
    offerType: c.offerType,
    value: c.value,
    maxDiscount: c.maxDiscount,
    minBill: c.minBill,
    validityDays: c.validityDays,
    totalBudget: c.totalBudget,
    perCustomerLimit: c.perCustomerLimit,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt?.toISOString() ?? null,
  };
}
