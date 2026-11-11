import "server-only";

import type { Prisma, SmsStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getSmsProvider } from "@/server/providers/sms";

export const SMS_LOG_PAGE_SIZE = 50;
/** Warn below this many taka of gateway credit (env SMS_LOW_BALANCE). */
export const SMS_LOW_BALANCE = Number(process.env.SMS_LOW_BALANCE) || 200;

export type SmsBalance =
  | { kind: "ok"; provider: string; taka: number; low: boolean }
  | { kind: "unsupported"; provider: string }
  | { kind: "error"; provider: string; message: string };

let cache: { at: number; value: SmsBalance } | undefined;
const CACHE_MS = 60_000;

/** Gateway credit, cached for a minute so the page never hammers the gateway. Never throws. */
export async function getSmsBalance(): Promise<SmsBalance> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value: SmsBalance;
  let provider = process.env.SMS_DRIVER ?? "console";
  try {
    const sms = getSmsProvider();
    provider = sms.name;
    if (!sms.balance) value = { kind: "unsupported", provider };
    else {
      const taka = await sms.balance();
      value = { kind: "ok", provider, taka, low: taka < SMS_LOW_BALANCE };
    }
  } catch (err) {
    value = { kind: "error", provider, message: err instanceof Error ? err.message : "unknown error" };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Delivery log (newest first). Bodies are not returned: they can hold amounts and upload links. */
export async function listSmsLog(f: { phone?: string; status?: SmsStatus; purpose?: string; page: number }) {
  const where: Prisma.SmsLogWhereInput = { toPhone: f.phone, status: f.status, purpose: f.purpose };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, total, last24] = await Promise.all([
    db.smsLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * SMS_LOG_PAGE_SIZE,
      take: SMS_LOG_PAGE_SIZE,
      select: {
        id: true,
        toPhone: true,
        provider: true,
        providerRef: true,
        status: true,
        attempt: true,
        error: true,
        purpose: true,
        createdAt: true,
        redemptionId: true,
      },
    }),
    db.smsLog.count({ where }),
    db.smsLog.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  const count = (s: SmsStatus) => last24.find((g) => g.status === s)?._count ?? 0;
  return { rows, total, pages: Math.max(1, Math.ceil(total / SMS_LOG_PAGE_SIZE)), sent24h: count("SENT"), failed24h: count("FAILED") };
}
