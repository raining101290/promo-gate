import "@/lib/zod-config";

import { z } from "zod";

import { normalizeBdPhone } from "@/lib/phone";

export type LoginTarget = { channel: "EMAIL" | "SMS"; target: string };

const emailSchema = z.email();

/** Parses "email or BD phone" into a channel + normalised target (lowercased email / E.164 phone). */
export function parseLoginTarget(raw: string): LoginTarget | null {
  const value = raw.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return emailSchema.safeParse(email).success ? { channel: "EMAIL", target: email } : null;
  }
  const phone = normalizeBdPhone(value);
  return phone ? { channel: "SMS", target: phone } : null;
}

export const TARGET_ERROR = "Enter a valid email or BD mobile number (01XXXXXXXXX)";

export const loginTargetSchema = z
  .string()
  .max(254)
  .transform((value, ctx) => {
    const parsed = parseLoginTarget(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: TARGET_ERROR });
      return z.NEVER;
    }
    return parsed;
  });

export const otpRequestSchema = z.object({ target: loginTargetSchema });

export const otpVerifySchema = z.object({
  target: loginTargetSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  next: z.string().optional(),
});
