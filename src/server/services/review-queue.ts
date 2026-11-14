import "server-only";

import type { OfferRequestStatus, Prisma } from "@/generated/prisma/client";
import { normalizeBdPhone } from "@/lib/phone";
import { db } from "@/server/db";

export const PAGE_SIZE = 20;
export const STATUSES: OfferRequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export type QueueFilter = { status?: OfferRequestStatus; q?: string; page: number };

function searchWhere(q: string | undefined): Prisma.OfferRequestWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const or: Prisma.OfferRequestWhereInput[] = [
    { invoiceNumber: { contains: term.toUpperCase() } },
    { submittedEmail: { contains: term, mode: "insensitive" } },
    { customer: { email: { contains: term, mode: "insensitive" } } },
  ];
  // Phones are stored E.164 (+8801...). Match a full number in any accepted format, or a digit fragment.
  const phone = normalizeBdPhone(term);
  const digits = term.replace(/\D/g, "");
  const phoneTerm = phone ?? (digits.length >= 4 ? digits : null);
  if (phoneTerm) {
    or.push({ submittedPhone: { contains: phoneTerm } }, { customer: { phone: { contains: phoneTerm } } });
  }
  return { OR: or };
}

export async function listOfferRequests({ status, q, page }: QueueFilter) {
  const search = searchWhere(q);
  const where: Prisma.OfferRequestWhereInput = { ...search, ...(status ? { status } : {}) };

  const [rows, total, counts] = await Promise.all([
    db.offerRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        submittedEmail: true,
        submittedPhone: true,
        createdAt: true,
        reviewedAt: true,
        source: true,
        reviewedBy: { select: { name: true } },
        customer: { select: { email: true, phone: true } },
      },
    }),
    db.offerRequest.count({ where }),
    // Tab counts respect the search but not the status filter.
    db.offerRequest.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
  ]);

  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OfferRequestStatus, number>;
  for (const c of counts) statusCounts[c.status] = c._count._all;

  return {
    rows: rows.map((r) => ({
      ...r,
      contactMismatch: r.submittedEmail !== r.customer.email || r.submittedPhone !== r.customer.phone,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    statusCounts,
  };
}

export async function getOfferRequestForReview(id: string) {
  const request = await db.offerRequest.findUnique({
    where: { id },
    include: {
      reviewedBy: { select: { name: true, email: true } },
      voucher: {
        select: { id: true, code: true, status: true, expiresAt: true, offerType: true, value: true, maxDiscount: true, minBill: true, campaign: { select: { name: true } } },
      },
      customer: {
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          createdAt: true,
          _count: { select: { vouchers: true, redemptions: true } },
        },
      },
    },
  });
  if (!request) return null;

  const previous = await db.offerRequest.findMany({
    where: { customerId: request.customerId, id: { not: id } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      createdAt: true,
      rejectReason: true,
      submittedEmail: true,
      submittedPhone: true,
      voucher: { select: { status: true, campaign: { select: { name: true } } } },
    },
  });

  return {
    request,
    previous,
    emailMismatch: request.submittedEmail !== request.customer.email,
    phoneMismatch: request.submittedPhone !== request.customer.phone,
  };
}
