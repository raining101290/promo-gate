import "@/lib/zod-config";

import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const reviewRedemptionSchema = z
  .object({
    action: z.enum(["verify", "dispute", "reject"]),
    reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional().transform((v) => v || undefined),
  })
  .refine((v) => v.action === "verify" || !!v.reason, { path: ["reason"], message: "A reason is required to dispute or reject" });

/** Period as Dhaka calendar days, both inclusive. */
export const createSettlementSchema = z
  .object({ partnerId: z.string().min(1), from: day, to: day })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "End date must be on or after the start date" });

export const markPaidSchema = z.object({
  paymentRef: z
    .string()
    .trim()
    .min(4, "Enter the bank transaction reference or bKash TrxID")
    .max(64, "Reference is too long")
    .regex(/^[A-Za-z0-9 ._/#-]+$/, "Letters, numbers and - _ / # . only"),
});
