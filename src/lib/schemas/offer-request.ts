import "@/lib/zod-config";

import { z } from "zod";

import { normalizeBdPhone } from "@/lib/phone";

/** Trim + uppercase; then allow letters, digits and common invoice punctuation. */
export const invoiceNumberSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(3, "Enter your invoice number")
      .max(64, "Invoice number is too long")
      .regex(/^[A-Z0-9#\-/_.]+$/, "Invoice number can only contain letters, numbers and - / _ . #"),
  );

export const customerEmailSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address").max(254));

export const bdPhoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizeBdPhone(value);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a BD mobile number like 01XXXXXXXXX" });
    return z.NEVER;
  }
  return phone;
});

export const offerRequestInputSchema = z.object({
  invoiceNumber: invoiceNumberSchema,
  email: customerEmailSchema,
  phone: bdPhoneSchema,
});

export type OfferRequestInput = z.output<typeof offerRequestInputSchema>;
export type OfferRequestField = keyof OfferRequestInput;
