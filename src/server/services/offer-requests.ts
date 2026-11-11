import "server-only";

import type { LoginTarget } from "@/lib/schemas/auth";
import type { OfferRequestInput } from "@/lib/schemas/offer-request";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";
import { requestOtp } from "@/server/services/otp";

export const DUPLICATE_INVOICE_MESSAGE = "This invoice has already been submitted";
export const CONTACT_CONFLICT_MESSAGE =
  "This email and phone number belong to two different accounts. Use the email and phone from the same account, or contact support.";

export type SubmitOfferRequestResult =
  | {
      ok: true;
      offerRequestId: string;
      /** null when the caller is already logged in as this customer (no OTP needed). */
      otp: (LoginTarget & { sent: boolean }) | null;
    }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number; message: string }
  | { ok: false; reason: "duplicate_invoice" | "contact_conflict"; message: string };

type Created = { offerRequestId: string; customer: { id: string; email: string; phone: string } };

/**
 * Public invoice submission. Links the request to the customer owning the email or phone, creating
 * one if neither exists. Existing customers' contact details are never changed here (that would let
 * anyone redirect a victim's OTPs). Then sends a login OTP to a contact the customer already owns.
 */
export async function submitOfferRequest(
  input: OfferRequestInput,
  ctx: { ip: string; currentCustomerId?: string | null },
): Promise<SubmitOfferRequestResult> {
  const rl = await limit("offerSubmitIp", ctx.ip);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.retryAfterSeconds / 60);
    return {
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: rl.retryAfterSeconds,
      message: `Too many submissions. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  let created: Created | "duplicate_invoice" | "contact_conflict";
  try {
    created = await createRequest(input);
  } catch (err) {
    // Lost a race on a unique key (invoice or a brand-new customer's email/phone): resolve once more.
    if (!isUniqueViolation(err)) throw err;
    created = await createRequest(input);
  }
  if (created === "duplicate_invoice") return { ok: false, reason: created, message: DUPLICATE_INVOICE_MESSAGE };
  if (created === "contact_conflict") return { ok: false, reason: created, message: CONTACT_CONFLICT_MESSAGE };

  const { customer, offerRequestId } = created;
  if (ctx.currentCustomerId === customer.id) return { ok: true, offerRequestId, otp: null };

  // OTP only to a contact the customer already owns: the account email, or the submitted phone if it
  // is the account's phone. Honour the customer's channel choice; SMS falls back to email otherwise.
  const ownsPhone = customer.phone === input.phone;
  const wantEmail = input.otpChannel === "EMAIL" || !ownsPhone;
  const target: LoginTarget = wantEmail ? { channel: "EMAIL", target: customer.email } : { channel: "SMS", target: customer.phone };
  const otp = await requestOtp(target, { ip: ctx.ip });
  return { ok: true, offerRequestId, otp: { ...target, sent: otp.ok } };
}

async function createRequest(input: OfferRequestInput): Promise<Created | "duplicate_invoice" | "contact_conflict"> {
  return db.$transaction(async (tx) => {
    const existing = await tx.offerRequest.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
      select: { id: true },
    });
    if (existing) return "duplicate_invoice";

    const matches = await tx.customer.findMany({
      where: { deletedAt: null, OR: [{ email: input.email }, { phone: input.phone }] },
      select: { id: true, email: true, phone: true },
    });
    if (matches.length > 1) return "contact_conflict";

    const isNewCustomer = matches.length === 0;
    const customer =
      matches[0] ??
      (await tx.customer.create({
        data: { email: input.email, phone: input.phone },
        select: { id: true, email: true, phone: true },
      }));

    const request = await tx.offerRequest.create({
      data: {
        customerId: customer.id,
        invoiceNumber: input.invoiceNumber,
        submittedEmail: input.email,
        submittedPhone: input.phone,
        status: "PENDING",
      },
      select: { id: true },
    });

    await writeAudit(
      {
        actorType: "CUSTOMER",
        actorId: customer.id,
        action: "offer_request.submitted",
        entityType: "OfferRequest",
        entityId: request.id,
        meta: {
          invoiceNumber: input.invoiceNumber,
          newCustomer: isNewCustomer,
          contactMatchesCustomer: customer.email === input.email && customer.phone === input.phone,
        },
      },
      tx,
    );

    return { offerRequestId: request.id, customer };
  });
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
