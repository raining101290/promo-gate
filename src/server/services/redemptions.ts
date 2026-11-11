import "server-only";

import bcrypt from "bcryptjs";

import { formatBDT, quoteRedemption } from "@/lib/money";
import { offerConditions, offerHeadline, type OfferTerms } from "@/lib/offer";
import { redemptionRef } from "@/lib/redemption";
import { branchRedemptionSms, customerReceiptSms } from "@/lib/sms-text";
import { formatDhakaDateTime } from "@/lib/time";
import type { Prisma, RedemptionStatus, VoucherStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { limit, RATE_LIMITS, resetLimit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";
import { appUrl } from "@/server/env";
import { notifyCustomer, sendSms } from "@/server/services/notifications";
import { transitionVoucher } from "@/server/services/vouchers";

export const PIN_MAX_FAILURES = RATE_LIMITS.pinFailure.limit;
export const PIN_LOCK_MS = 15 * 60 * 1000;

export type RedeemFailure =
  | { ok: false; reason: "branch_not_found" | "branch_unavailable" | "voucher_not_found" | "voucher_expired" | "invalid_bill" }
  | { ok: false; reason: "voucher_not_active"; status: VoucherStatus }
  | { ok: false; reason: "voucher_locked"; retryAfterSeconds: number }
  | { ok: false; reason: "below_min_bill"; minBill: number };

export type PreviewResult =
  | { ok: true; bill: number; discount: number; customerPays: number; branch: { name: string; partnerName: string } }
  | RedeemFailure;

export type ConfirmResult =
  | { ok: true; redemptionId: string }
  | RedeemFailure
  | { ok: false; reason: "wrong_pin"; attemptsLeft: number }
  | { ok: false; reason: "already_redeemed" };

const pinSubject = (branchId: string, voucherId: string) => `${branchId}:${voucherId}`;

/**
 * Branch by code with partner contract, including inactive ones (so pages can explain why).
 * Display fields ONLY: customer pages render from this, so it must never carry pinHash or smsPhone
 * (React's dev payload serialises awaited server values; see the Phase 9 audit, finding F1).
 */
export async function getBranchByCode(branchCode: string) {
  return db.branch.findUnique({
    where: { branchCode },
    select: {
      id: true,
      name: true,
      area: true,
      branchCode: true,
      active: true,
      partner: { select: { name: true, contractStatus: true } },
    },
  });
}

export function branchAcceptsVouchers(b: { active: boolean; partner: { contractStatus: string } }) {
  return b.active && b.partner.contractStatus === "ACTIVE";
}

/** The customer's vouchers usable right now (ACTIVE and unexpired), soonest-expiring first. */
export async function listRedeemableVouchers(customerId: string, now: Date = new Date()) {
  const vouchers = await db.voucher.findMany({
    where: { customerId, status: "ACTIVE", expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      expiresAt: true,
      pinLockedUntil: true,
      offerType: true,
      value: true,
      maxDiscount: true,
      minBill: true,
      campaign: { select: { name: true } },
    },
  });
  return vouchers.map((v) => {
    const terms: OfferTerms = { offerType: v.offerType, value: v.value, maxDiscount: v.maxDiscount, minBill: v.minBill };
    return {
      id: v.id,
      campaignName: v.campaign.name,
      expiresAt: v.expiresAt,
      lockedUntil: v.pinLockedUntil && v.pinLockedUntil > now ? v.pinLockedUntil : null,
      terms,
      headline: offerHeadline(terms),
      conditions: offerConditions(terms),
    };
  });
}

/** Shared checks for preview and confirm (everything except the PIN). Read-only. */
async function check(customerId: string, voucherId: string, branchCode: string, billPaisa: number, now: Date) {
  const branch = await getBranchByCode(branchCode);
  if (!branch) return { ok: false, reason: "branch_not_found" } as const;
  if (!branchAcceptsVouchers(branch)) return { ok: false, reason: "branch_unavailable" } as const;

  // Ownership is part of the lookup: another customer's voucher id behaves exactly like a missing one.
  const voucher = await db.voucher.findFirst({
    where: { id: voucherId, customerId },
    select: { id: true, status: true, expiresAt: true, pinLockedUntil: true, offerType: true, value: true, maxDiscount: true, minBill: true },
  });
  if (!voucher) return { ok: false, reason: "voucher_not_found" } as const;
  if (voucher.status !== "ACTIVE") return { ok: false, reason: "voucher_not_active", status: voucher.status } as const;
  if (voucher.expiresAt <= now) return { ok: false, reason: "voucher_expired" } as const;
  if (voucher.pinLockedUntil && voucher.pinLockedUntil > now) {
    return { ok: false, reason: "voucher_locked", retryAfterSeconds: Math.ceil((voucher.pinLockedUntil.getTime() - now.getTime()) / 1000) } as const;
  }

  const quote = quoteRedemption(voucher, billPaisa);
  if (!quote.ok) return quote;
  return { ok: true, branch, voucher, quote } as const;
}

/** Step 1 -> 2: validates everything except the PIN and returns the authoritative amounts. */
export async function previewRedemption(customerId: string, voucherId: string, branchCode: string, billPaisa: number): Promise<PreviewResult> {
  const c = await check(customerId, voucherId, branchCode, billPaisa, new Date());
  if (!c.ok) return c;
  return { ok: true, ...stripOk(c.quote), branch: { name: c.branch.name, partnerName: c.branch.partner.name } };
}

function stripOk(q: { bill: number; discount: number; customerPays: number }) {
  return { bill: q.bill, discount: q.discount, customerPays: q.customerPays };
}

/**
 * Step 2 -> 3: verifies the cashier's PIN and redeems.
 * - PIN failures are counted per (branch, voucher) in a 15-minute window; the 5th locks the voucher
 *   for 15 minutes (any branch) and is audited.
 * - The redeem itself is ONE transaction: branch re-checked under a row lock, voucher moved
 *   ACTIVE -> REDEEMED conditionally (owner, unexpired, not locked), Redemption created CLAIMED.
 *   A concurrent/double submit loses the conditional update and gets "already_redeemed";
 *   Redemption.voucherId being unique is the backstop.
 */
export async function confirmRedemption(
  customerId: string,
  voucherId: string,
  branchCode: string,
  billPaisa: number,
  pin: string,
): Promise<ConfirmResult> {
  const now = new Date();
  const c = await check(customerId, voucherId, branchCode, billPaisa, now);
  if (!c.ok) return c;
  const { branch, voucher, quote } = c;

  // The hash is loaded here, server-side, only for the comparison; it never leaves this function.
  const { pinHash } = await db.branch.findUniqueOrThrow({ where: { id: branch.id }, select: { pinHash: true } });
  if (!(await bcrypt.compare(pin, pinHash))) {
    const subject = pinSubject(branch.id, voucher.id);
    const hit = await limit("pinFailure", subject);
    // Durable record per wrong PIN (limiter rows are reset), used by fraud signals on the staff list.
    await writeAudit({
      actorType: "CUSTOMER",
      actorId: customerId,
      action: "voucher.pin_failed",
      entityType: "Branch",
      entityId: branch.id,
      meta: { voucherId: voucher.id },
    });
    if (hit.allowed && hit.remaining > 0) return { ok: false, reason: "wrong_pin", attemptsLeft: hit.remaining };

    // 5th failure (or already over): lock the voucher and start the next window clean.
    const lockedUntil = new Date(now.getTime() + PIN_LOCK_MS);
    await db.$transaction(async (tx) => {
      await tx.voucher.updateMany({ where: { id: voucher.id, status: "ACTIVE" }, data: { pinLockedUntil: lockedUntil } });
      await writeAudit(
        {
          actorType: "CUSTOMER",
          actorId: customerId,
          action: "voucher.pin_locked",
          entityType: "Voucher",
          entityId: voucher.id,
          meta: { branchId: branch.id, branchCode, failures: PIN_MAX_FAILURES, lockedUntil: lockedUntil.toISOString() },
        },
        tx,
      );
    });
    await resetLimit("pinFailure", subject);
    return { ok: false, reason: "voucher_locked", retryAfterSeconds: PIN_LOCK_MS / 1000 };
  }

  const outcome = await db.$transaction(async (tx) => {
    // Lock the branch row (shared): a concurrent deactivation waits for us, and we see its committed state.
    const eligible = await tx.$queryRaw<{ id: string }[]>`
      SELECT b.id FROM "Branch" b JOIN "Partner" p ON p.id = b."partnerId"
      WHERE b.id = ${branch.id} AND b.active AND p."contractStatus" = 'ACTIVE'
      FOR SHARE OF b`;
    if (eligible.length === 0) return { ok: false, reason: "branch_unavailable" } as const;

    const won = await transitionVoucher(tx, voucher.id, "ACTIVE", "REDEEMED", {
      customerId,
      expiresAt: { gt: now },
      OR: [{ pinLockedUntil: null }, { pinLockedUntil: { lte: now } }],
    });
    if (!won) return { ok: false, reason: "already_redeemed" } as const;

    const redemption = await tx.redemption.create({
      data: {
        voucherId: voucher.id,
        branchId: branch.id,
        customerId,
        billAmount: quote.bill,
        discountAmount: quote.discount,
        customerPaid: quote.customerPays,
        status: "CLAIMED",
        redeemedAt: now,
      },
      select: { id: true },
    });
    await writeAudit(
      {
        actorType: "CUSTOMER",
        actorId: customerId,
        action: "voucher.redeemed",
        entityType: "Redemption",
        entityId: redemption.id,
        meta: { voucherId: voucher.id, branchId: branch.id, bill: quote.bill, discount: quote.discount, customerPaid: quote.customerPays },
      },
      tx,
    );
    return { ok: true, redemptionId: redemption.id } as const;
  });

  if (!outcome.ok) return outcome;

  await resetLimit("pinFailure", pinSubject(branch.id, voucher.id));
  // Notifications are NOT sent here: callers schedule notifyRedemption() after responding, so SMS
  // retries/backoff never delay the success screen and a gateway failure can't affect the redemption.
  return outcome;
}

/** Allowed redemption status moves. RECEIPT_UPLOADED -> itself = replacing the photo before review. */
const REDEMPTION_TRANSITIONS: Record<RedemptionStatus, readonly RedemptionStatus[]> = {
  CLAIMED: ["RECEIPT_UPLOADED", "VERIFIED", "DISPUTED", "REJECTED"],
  RECEIPT_UPLOADED: ["RECEIPT_UPLOADED", "VERIFIED", "DISPUTED", "REJECTED"],
  DISPUTED: ["VERIFIED", "REJECTED"],
  VERIFIED: [],
  REJECTED: [],
};

/**
 * THE way to change a redemption's status (inside a transaction). Conditional on the current status
 * (+ guards); returns true only if this caller made the change.
 */
export async function transitionRedemption(
  tx: Prisma.TransactionClient,
  id: string,
  from: readonly RedemptionStatus[],
  to: RedemptionStatus,
  data: Omit<Prisma.RedemptionUncheckedUpdateManyInput, "status"> = {},
  guard: Prisma.RedemptionWhereInput = {},
): Promise<boolean> {
  for (const f of from) {
    if (!REDEMPTION_TRANSITIONS[f].includes(to)) throw new Error(`Illegal redemption transition ${f} -> ${to}`);
  }
  const { count } = await tx.redemption.updateMany({ where: { ...guard, id, status: { in: [...from] } }, data: { ...data, status: to } });
  return count === 1;
}

/**
 * Post-commit messages for a redemption: branch SMS (cashier record) + customer SMS/email receipt with
 * the upload link. Each SMS is retried and every attempt logged in SmsLog. Never throws.
 */
export async function notifyRedemption(redemptionId: string): Promise<void> {
  try {
    const r = await db.redemption.findUnique({
      where: { id: redemptionId },
      select: {
        id: true,
        customerId: true,
        billAmount: true,
        discountAmount: true,
        customerPaid: true,
        redeemedAt: true,
        branch: { select: { name: true, branchCode: true, smsPhone: true, partner: { select: { name: true } } } },
      },
    });
    if (!r) return;
    const ref = redemptionRef(r.id);
    const uploadUrl = `${appUrl()}/dashboard/redemptions/${r.id}`;

    await sendSms(
      r.branch.smsPhone,
      branchRedemptionSms({
        branchName: r.branch.name,
        branchCode: r.branch.branchCode,
        bill: r.billAmount,
        discount: r.discountAmount,
        customerPays: r.customerPaid,
        ref,
        at: r.redeemedAt,
      }),
      { purpose: "branch_redemption", redemptionId: r.id },
    );

    await notifyCustomer(r.customerId, {
      purpose: "customer_receipt",
      redemptionId: r.id,
      sms: customerReceiptSms({ branchName: r.branch.name, branchCode: r.branch.branchCode, discount: r.discountAmount, ref, uploadUrl }),
      emailSubject: `Receipt: Hosting.com voucher used at ${r.branch.partner.name} (${ref})`,
      email:
        `Your Hosting.com voucher was used at ${r.branch.partner.name}, ${r.branch.name} on ${formatDhakaDateTime(r.redeemedAt)} (Dhaka).\n\n` +
        `Bill: ${formatBDT(r.billAmount)}\nVoucher paid: ${formatBDT(r.discountAmount)}\nYou paid: ${formatBDT(r.customerPaid)}\nReference: ${ref}\n\n` +
        `Please upload a photo of the café's printed receipt so we can settle with the café:\n${uploadUrl}`,
    });
  } catch (err) {
    console.error(`[notify] redemption ${redemptionId} notifications failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

/** For the success screen: the customer's own redemption, or null. */
export async function getCustomerRedemption(customerId: string, redemptionId: string) {
  return db.redemption.findFirst({
    where: { id: redemptionId, customerId },
    select: {
      id: true,
      billAmount: true,
      discountAmount: true,
      customerPaid: true,
      redeemedAt: true,
      branch: { select: { name: true, area: true, branchCode: true, partner: { select: { name: true } } } },
    },
  });
}

