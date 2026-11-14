import "server-only";

import { redemptionRef } from "@/lib/redemption";
import { db } from "@/server/db";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";
import { transitionVouchers } from "@/server/services/vouchers";

/** Everything we hold about a customer, as JSON they can download. Staff identities are not included. */
export async function exportCustomerData(customerId: string) {
  if (!(await limit("dataExport", customerId)).allowed) return { ok: false as const, reason: "rate_limited" as const };

  const c = await db.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: {
      email: true,
      phone: true,
      name: true,
      createdAt: true,
      offerRequests: { orderBy: { createdAt: "asc" }, select: { invoiceNumber: true, submittedEmail: true, submittedPhone: true, status: true, rejectReason: true, createdAt: true, reviewedAt: true } },
      vouchers: {
        orderBy: { issuedAt: "asc" },
        select: { code: true, status: true, offerType: true, value: true, maxDiscount: true, minBill: true, issuedAt: true, expiresAt: true, campaign: { select: { name: true } } },
      },
      redemptions: {
        orderBy: { redeemedAt: "asc" },
        select: {
          id: true,
          redeemedAt: true,
          billAmount: true,
          discountAmount: true,
          customerPaid: true,
          posReceiptNo: true,
          receiptImageKey: true,
          status: true,
          branch: { select: { name: true, partner: { select: { name: true } } } },
        },
      },
    },
  });
  if (!c) return { ok: false as const, reason: "not_found" as const };

  const [messages, emails] = await Promise.all([
    db.smsLog.findMany({
      where: { toPhone: c.phone, status: "SENT" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, purpose: true, body: true }, // OTP bodies are stored redacted
    }),
    db.emailLog.findMany({
      where: { toEmail: c.email.toLowerCase(), status: "SENT" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, purpose: true, subject: true }, // bodies are never stored
    }),
  ]);

  await writeAudit({ actorType: "CUSTOMER", actorId: customerId, action: "customer.data_exported", entityType: "Customer", entityId: customerId });

  return {
    ok: true as const,
    data: {
      exportedAt: new Date().toISOString(),
      note: "Amounts are in paisa (1 BDT = 100 paisa). Percent values are basis points (1500 = 15%). Times are UTC.",
      profile: { email: c.email, phone: c.phone, name: c.name, createdAt: c.createdAt },
      offerRequests: c.offerRequests,
      vouchers: c.vouchers.map(({ campaign, ...v }) => ({ ...v, campaign: campaign.name })),
      redemptions: c.redemptions.map(({ id, receiptImageKey, branch, ...r }) => ({
        reference: redemptionRef(id),
        ...r,
        cafe: `${branch.partner.name}, ${branch.name}`,
        receiptUploaded: !!receiptImageKey,
      })),
      smsMessages: messages,
      emails,
    },
  };
}

/**
 * Self-service soft delete. Kept for accounting: redemptions (amounts, branch, dates, receipt photos)
 * and the invoice numbers on requests. Removed/scrubbed: contact details everywhere, OTP codes, SMS
 * copies and email log entries for the customer. Active vouchers are voided; pending requests are closed.
 * The customer can't log in afterwards (their contacts no longer match) and existing sessions die
 * because every customer page/route re-checks deletedAt.
 */
export async function deleteCustomer(customerId: string) {
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { email: true, phone: true } });
    if (!c) return { ok: false as const };
    const now = new Date();

    const voided = await transitionVouchers(tx, { customerId }, "ACTIVE", "VOID");
    const closed = await tx.offerRequest.updateMany({
      where: { customerId, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: "Customer deleted their account", reviewedAt: now },
    });
    await tx.offerRequest.updateMany({ where: { customerId }, data: { submittedEmail: "[deleted]", submittedPhone: "[deleted]", customerName: null } });
    await tx.smsLog.updateMany({ where: { toPhone: c.phone }, data: { toPhone: "[deleted]", body: "[deleted]" } });
    await tx.emailLog.updateMany({ where: { toEmail: c.email.toLowerCase() }, data: { toEmail: "[deleted]", subject: "[deleted]" } });
    const otps = await tx.otpCode.deleteMany({ where: { OR: [{ customerId }, { target: c.email }, { target: c.phone }] } });
    await tx.customer.update({
      where: { id: customerId },
      data: { email: `deleted+${customerId}@deleted.invalid`, phone: `deleted:${customerId}`, name: null, deletedAt: now },
    });
    const redemptionsKept = await tx.redemption.count({ where: { customerId } });
    await writeAudit(
      {
        actorType: "CUSTOMER",
        actorId: customerId,
        action: "customer.deleted",
        entityType: "Customer",
        entityId: customerId,
        meta: { vouchersVoided: voided, pendingRequestsClosed: closed.count, otpCodesDeleted: otps.count, redemptionsKept },
      },
      tx,
    );
    return { ok: true as const, vouchersVoided: voided, redemptionsKept };
  });
}

export async function getAccountSummary(customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: {
      email: true,
      phone: true,
      createdAt: true,
      _count: { select: { offerRequests: true, vouchers: true, redemptions: true } },
      vouchers: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
}
