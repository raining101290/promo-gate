import "@/lib/zod-config";

import { z } from "zod";

import { bdPhoneSchema, customerEmailSchema, invoiceNumberSchema } from "./offer-request";

/** The body Upmind sends, as raw strings (the validatedCode is checked over these exact values). */
export const upmindPushRawSchema = z.object({
  customerName: z.string().max(120).optional().default(""),
  email: z.string().min(3).max(254),
  phone: z.string().min(6).max(32),
  invoiceNumber: z.string().min(1).max(64),
  validatedCode: z.string().min(1).max(128),
});

/** Normalised values we store (same rules as the old public form). */
export const upmindPushSchema = z.object({
  customerName: z.string().transform((v) => v.trim().replace(/\s+/g, " ")),
  email: customerEmailSchema,
  phone: bdPhoneSchema,
  invoiceNumber: invoiceNumberSchema,
});
