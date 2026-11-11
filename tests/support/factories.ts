// Minimal fixtures written straight to the test DB. Each call uses unique values, so tests in a file
// never collide and don't need cleanup (the whole DB is reset per run).
import bcrypt from "bcryptjs";

import type { ContractStatus, OfferType, RedemptionStatus, StaffRole, VoucherStatus } from "@/generated/prisma/client";
import { snapshotTerms } from "@/lib/offer";
import { db } from "@/server/db";

let seq = 0;
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DAY = 24 * 60 * 60 * 1000;

export function staff(role: StaffRole) {
  return db.staffUser.create({ data: { email: `${role.toLowerCase()}-${uid()}@test.local`, name: `${role} ${uid()}`, passwordHash: "x", role } });
}

export function campaign(over: Partial<{ offerType: OfferType; value: number; maxDiscount: number | null; minBill: number | null; validityDays: number; totalBudget: number | null; perCustomerLimit: number | null; startsAt: Date; endsAt: Date | null; active: boolean }> = {}) {
  return db.campaign.create({
    data: { name: `Campaign ${uid()}`, offerType: "FIXED", value: 500_00, validityDays: 30, startsAt: new Date(Date.now() - DAY), active: true, ...over },
  });
}

export function customer() {
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return db.customer.create({ data: { email: `c-${uid()}@test.local`, phone: `+88017${digits}`, name: "Test" } });
}

export function pendingRequest(customerId: string) {
  return db.offerRequest.create({
    data: { customerId, invoiceNumber: `INV-${uid()}`.toUpperCase(), submittedEmail: "x@test.local", submittedPhone: "+8801700000000" },
  });
}

/** Partner + one branch. PIN hashed with a low bcrypt cost (fast tests; compare works with any cost). */
export async function partnerBranch(o: { pin?: string; active?: boolean; contractStatus?: ContractStatus } = {}) {
  const partner = await db.partner.create({
    data: { name: `Cafe ${uid()}`, contactName: "Owner", contactPhone: "+8801700000001", payoutMethod: "BKASH", payoutAccount: "+8801700000001", contractStatus: o.contractStatus ?? "ACTIVE" },
  });
  const branch = await db.branch.create({
    data: {
      partnerId: partner.id,
      name: "Main",
      area: "Gulshan",
      address: "Road 1",
      smsPhone: "+8801700000002",
      branchCode: `b-${uid()}`,
      pinHash: await bcrypt.hash(o.pin ?? "1234", 4),
      active: o.active ?? true,
    },
  });
  return { partner, branch };
}

/** An issued voucher (request APPROVED + voucher with snapshotted terms). */
export async function voucher(o: { customerId: string; campaignId?: string; status?: VoucherStatus; expiresAt?: Date; terms?: Parameters<typeof snapshotTerms>[0] }) {
  const camp = o.campaignId ? await db.campaign.findUniqueOrThrow({ where: { id: o.campaignId } }) : await campaign();
  const req = await db.offerRequest.create({
    data: { customerId: o.customerId, invoiceNumber: `INV-${uid()}`.toUpperCase(), submittedEmail: "x@test.local", submittedPhone: "+8801700000000", status: "APPROVED" },
  });
  return db.voucher.create({
    data: {
      offerRequestId: req.id,
      campaignId: camp.id,
      customerId: o.customerId,
      code: uid().padEnd(24, "x"),
      status: o.status ?? "ACTIVE",
      expiresAt: o.expiresAt ?? new Date(Date.now() + 30 * DAY),
      ...snapshotTerms(o.terms ?? camp),
    },
  });
}

/** A redemption row directly (for settlement tests). */
export async function redemption(o: { branchId: string; status?: RedemptionStatus; discount?: number; bill?: number; redeemedAt?: Date }) {
  const c = await customer();
  const v = await voucher({ customerId: c.id, status: "REDEEMED" });
  return db.redemption.create({
    data: {
      voucherId: v.id,
      branchId: o.branchId,
      customerId: c.id,
      billAmount: o.bill ?? 1000_00,
      discountAmount: o.discount ?? 500_00,
      customerPaid: (o.bill ?? 1000_00) - (o.discount ?? 500_00),
      status: o.status ?? "VERIFIED",
      redeemedAt: o.redeemedAt ?? new Date(),
    },
  });
}
