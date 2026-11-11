import "server-only";

import { db } from "@/server/db";

// Heuristics only: shown as warning badges for a human reviewer. Nothing is blocked or auto-rejected.
const HOUR = 60 * 60 * 1000;
export const FRAUD_RULES = {
  repeatWindowMs: 1 * HOUR, // same customer redeems again within this window
  billMultiple: 3, // bill >= 3x the branch's recent average...
  billMinSamples: 5, // ...once the branch has at least this many redemptions to average
  billLookbackMs: 90 * 24 * HOUR,
  offHoursStart: 23, // Dhaka local hour, inclusive
  offHoursEnd: 7, // Dhaka local hour, exclusive
  pinFailureWindowMs: 24 * HOUR, // wrong PINs at the branch in the 24h before the redemption
  pinFailureThreshold: 5,
} as const;

export type FraudSignal = { code: "repeat" | "high_bill" | "off_hours" | "pin_failures"; label: string; detail: string };

type Row = { id: string; customerId: string; branchId: string; redeemedAt: Date; billAmount: number };

const dhakaHour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false });

/** Batched: a handful of queries for a whole page of redemptions. */
export async function computeFraudSignals(rows: Row[]): Promise<Map<string, FraudSignal[]>> {
  const out = new Map<string, FraudSignal[]>(rows.map((r) => [r.id, []]));
  if (rows.length === 0) return out;

  const times = rows.map((r) => r.redeemedAt.getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const branchIds = [...new Set(rows.map((r) => r.branchId))];

  const [neighbours, averages, pinFailures] = await Promise.all([
    db.redemption.findMany({
      where: {
        customerId: { in: customerIds },
        redeemedAt: { gte: new Date(minT - FRAUD_RULES.repeatWindowMs), lte: new Date(maxT + FRAUD_RULES.repeatWindowMs) },
      },
      select: { id: true, customerId: true, redeemedAt: true },
    }),
    db.redemption.groupBy({
      by: ["branchId"],
      where: { branchId: { in: branchIds }, status: { not: "REJECTED" }, redeemedAt: { gte: new Date(maxT - FRAUD_RULES.billLookbackMs) } },
      _avg: { billAmount: true },
      _count: { _all: true },
    }),
    db.auditLog.findMany({
      where: {
        action: "voucher.pin_failed",
        entityType: "Branch",
        entityId: { in: branchIds },
        createdAt: { gte: new Date(minT - FRAUD_RULES.pinFailureWindowMs), lte: new Date(maxT) },
      },
      select: { entityId: true, createdAt: true },
    }),
  ]);
  const avgByBranch = new Map(averages.map((a) => [a.branchId, { avg: a._avg.billAmount ?? 0, n: a._count._all }]));

  for (const r of rows) {
    const signals = out.get(r.id)!;
    const t = r.redeemedAt.getTime();

    const near = neighbours.filter((n) => n.customerId === r.customerId && n.id !== r.id && Math.abs(n.redeemedAt.getTime() - t) <= FRAUD_RULES.repeatWindowMs);
    if (near.length > 0) {
      const gapMin = Math.min(...near.map((n) => Math.round(Math.abs(n.redeemedAt.getTime() - t) / 60_000)));
      signals.push({ code: "repeat", label: "Repeat customer", detail: `Same customer redeemed ${near.length + 1}× within 1h (${gapMin} min apart)` });
    }

    const stats = avgByBranch.get(r.branchId);
    if (stats && stats.n >= FRAUD_RULES.billMinSamples && stats.avg > 0 && r.billAmount >= FRAUD_RULES.billMultiple * stats.avg) {
      signals.push({ code: "high_bill", label: `Bill ${(r.billAmount / stats.avg).toFixed(1)}× avg`, detail: `Branch average over ${stats.n} redemptions is ৳${Math.round(stats.avg / 100)}` });
    }

    const hhmm = dhakaHour.format(r.redeemedAt);
    const hour = Number(hhmm.slice(0, 2));
    if (hour >= FRAUD_RULES.offHoursStart || hour < FRAUD_RULES.offHoursEnd) {
      signals.push({ code: "off_hours", label: `Off-hours ${hhmm}`, detail: `Redeemed at ${hhmm} Dhaka time, outside 07:00–23:00` });
    }

    const fails = pinFailures.filter((p) => p.entityId === r.branchId && p.createdAt.getTime() <= t && p.createdAt.getTime() >= t - FRAUD_RULES.pinFailureWindowMs).length;
    if (fails >= FRAUD_RULES.pinFailureThreshold) {
      signals.push({ code: "pin_failures", label: `${fails} PIN failures`, detail: `${fails} wrong PINs at this branch in the 24h before` });
    }
  }
  return out;
}
