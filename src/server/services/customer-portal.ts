import "server-only";

import type { RedemptionStatus } from "@/generated/prisma/client";
import type { OfferTerms } from "@/lib/offer";
import { db } from "@/server/db";

// Read models for customer pages. Every query is scoped by customerId from the session; never by
// a client-supplied owner id.

/** What the customer sees. An ACTIVE voucher past expiresAt displays as EXPIRED even before a sweep flips it. */
export type VoucherDisplayStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "VOID";

export function voucherDisplayStatus(v: { status: VoucherDisplayStatus; expiresAt: Date }, now: Date): VoucherDisplayStatus {
  return v.status === "ACTIVE" && v.expiresAt <= now ? "EXPIRED" : v.status;
}

const voucherSelect = {
  id: true,
  code: true,
  status: true,
  issuedAt: true,
  expiresAt: true,
  // Terms come from the voucher's own snapshot, never the (editable) campaign.
  offerType: true,
  value: true,
  maxDiscount: true,
  minBill: true,
  campaign: { select: { name: true } },
  redemption: { select: { id: true, status: true, redeemedAt: true, branch: { select: { name: true, partner: { select: { name: true } } } } } },
} as const;

export type CustomerVoucher = {
  id: string;
  code: string;
  displayStatus: VoucherDisplayStatus;
  issuedAt: Date;
  expiresAt: Date;
  campaignName: string;
  terms: OfferTerms;
  redeemedAt: Date | null;
  redeemedAtBranch: string | null;
  redemptionId: string | null;
  redemptionStatus: RedemptionStatus | null;
};

function toCustomerVoucher(
  v: {
    id: string;
    code: string;
    status: VoucherDisplayStatus;
    issuedAt: Date;
    expiresAt: Date;
    offerType: OfferTerms["offerType"];
    value: number;
    maxDiscount: number | null;
    minBill: number | null;
    campaign: { name: string };
    redemption: { id: string; status: RedemptionStatus; redeemedAt: Date; branch: { name: string; partner: { name: string } } } | null;
  },
  now: Date,
): CustomerVoucher {
  const terms: OfferTerms = { offerType: v.offerType, value: v.value, maxDiscount: v.maxDiscount, minBill: v.minBill };
  return {
    id: v.id,
    code: v.code,
    displayStatus: voucherDisplayStatus(v, now),
    issuedAt: v.issuedAt,
    expiresAt: v.expiresAt,
    campaignName: v.campaign.name,
    terms,
    redeemedAt: v.redemption?.redeemedAt ?? null,
    redeemedAtBranch: v.redemption ? `${v.redemption.branch.partner.name}, ${v.redemption.branch.name}` : null,
    redemptionId: v.redemption?.id ?? null,
    redemptionStatus: v.redemption?.status ?? null,
  };
}

export async function getCustomerDashboard(customerId: string, now: Date = new Date()) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      email: true,
      name: true,
      offerRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          rejectReason: true,
          createdAt: true,
          reviewedAt: true,
          voucher: { select: { id: true } },
        },
      },
      vouchers: { orderBy: { expiresAt: "asc" }, select: voucherSelect },
    },
  });
  if (!customer) return null;

  const vouchers = customer.vouchers.map((v) => toCustomerVoucher(v, now));
  return {
    email: customer.email,
    name: customer.name,
    requests: customer.offerRequests,
    activeVouchers: vouchers.filter((v) => v.displayStatus === "ACTIVE"),
    pastVouchers: vouchers
      .filter((v) => v.displayStatus !== "ACTIVE")
      .sort((a, b) => (b.redeemedAt ?? b.expiresAt).getTime() - (a.redeemedAt ?? a.expiresAt).getTime()),
  };
}

/** Returns null if the voucher does not exist or belongs to another customer. */
export async function getCustomerVoucher(customerId: string, voucherId: string, now: Date = new Date()) {
  const v = await db.voucher.findFirst({ where: { id: voucherId, customerId }, select: voucherSelect });
  return v ? toCustomerVoucher(v, now) : null;
}

/** Customer's own redemption with receipt state, for the upload page. */
export async function getCustomerRedemptionDetail(customerId: string, redemptionId: string) {
  return db.redemption.findFirst({
    where: { id: redemptionId, customerId },
    select: {
      id: true,
      status: true,
      billAmount: true,
      discountAmount: true,
      customerPaid: true,
      redeemedAt: true,
      posReceiptNo: true,
      receiptImageKey: true,
      branch: { select: { name: true, partner: { select: { name: true } } } },
    },
  });
}
