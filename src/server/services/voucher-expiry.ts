import "server-only";

import { expiryReminderSms, plainTaka } from "@/lib/sms-text";
import { formatDhakaDateTime } from "@/lib/time";
import { db } from "@/server/db";
import { appUrl } from "@/server/env";
import { writeAudit } from "@/server/services/audit";
import { notifyCustomer } from "@/server/services/notifications";
import { transitionVouchers } from "@/server/services/vouchers";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REMINDER_LEAD_MS = 3 * DAY_MS;
const REMINDER_BATCH = 200;

export type ExpiryRunResult = { expired: number; reminded: number; reminderFailures: number; ranAt: string };

/**
 * Hourly job (src/app/api/cron/expire-vouchers):
 * 1. ACTIVE vouchers past expiresAt -> EXPIRED (one conditional bulk update, audited).
 * 2. "Expires in 3 days" reminder (SMS when enabled + email), at most once per voucher: each voucher is CLAIMED (reminderSentAt set
 *    where it is still null) before sending, so overlapping or repeated runs can't double-send.
 *    Vouchers whose whole life is <= 3 days don't get one (it would arrive right after issue).
 * Idempotent: running it twice in a row changes nothing the second time.
 */
export async function runVoucherExpiry(now: Date = new Date()): Promise<ExpiryRunResult> {
  const expired = await db.$transaction(async (tx) => {
    const ids = (await tx.voucher.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, select: { id: true }, take: 5000 })).map(
      (v) => v.id,
    );
    if (ids.length === 0) return 0;
    const count = await transitionVouchers(tx, { id: { in: ids }, expiresAt: { lte: now } }, "ACTIVE", "EXPIRED");
    await writeAudit(
      {
        actorType: "SYSTEM",
        actorId: "system",
        action: "voucher.expired_batch",
        entityType: "Voucher",
        entityId: "batch",
        meta: { count, voucherIds: ids.slice(0, 500) },
      },
      tx,
    );
    return count;
  });

  const due = await db.voucher.findMany({
    where: {
      status: "ACTIVE",
      reminderSentAt: null,
      expiresAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
      customer: { deletedAt: null },
    },
    select: { id: true, issuedAt: true, expiresAt: true, offerType: true, value: true, customerId: true },
    take: REMINDER_BATCH,
  });

  let reminded = 0;
  let reminderFailures = 0;
  for (const v of due) {
    if (v.expiresAt.getTime() - v.issuedAt.getTime() <= REMINDER_LEAD_MS) continue;
    const claimed = await db.voucher.updateMany({ where: { id: v.id, reminderSentAt: null, status: "ACTIVE" }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue; // another run got it
    const discountLabel = v.offerType === "FIXED" ? `${plainTaka(v.value)} BDT` : `${v.value / 100}%`;
    const dashboardUrl = `${appUrl()}/dashboard`;
    // SMS (when enabled) + email: with SMS off, email is the only way customers hear about it.
    const sent = await notifyCustomer(v.customerId, {
      purpose: "expiry_reminder",
      sms: expiryReminderSms({ discountLabel, expiresAt: v.expiresAt, dashboardUrl }),
      emailSubject: `Your ${discountLabel} Hosting.com coffee voucher expires soon`,
      email:
        `Your ${discountLabel} Hosting.com coffee voucher expires on ${formatDhakaDateTime(v.expiresAt)} (Dhaka time).\n\n` +
        `Use it at any partner café before then. Open your vouchers: ${dashboardUrl}`,
    });
    if (sent) reminded++;
    else reminderFailures++; // claimed but undelivered: logged in SmsLog; not retried, so "at most once" holds
  }

  return { expired, reminded, reminderFailures, ranAt: now.toISOString() };
}
