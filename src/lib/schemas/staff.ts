import "@/lib/zod-config";

import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

/** Preset rejection reasons. The label is shown to the customer, so keep it plain and polite. */
export const REJECT_REASONS = {
  INVOICE_NOT_FOUND: "We couldn't find this invoice",
  INVOICE_UNPAID: "This invoice is not paid yet",
  CONTACT_MISMATCH: "The email or phone doesn't match the invoice",
  NOT_ELIGIBLE: "This purchase isn't eligible for the promotion",
  ALREADY_CLAIMED: "An offer was already issued for this purchase",
  OTHER: "Other",
} as const;

export type RejectReasonCode = keyof typeof REJECT_REASONS;

export const rejectSchema = z
  .object({
    reasonCode: z.enum(Object.keys(REJECT_REASONS) as [RejectReasonCode, ...RejectReasonCode[]]),
    note: z
      .string()
      .trim()
      .max(300, "Keep the note under 300 characters")
      .optional()
      .transform((v) => v || undefined),
  })
  .refine((v) => v.reasonCode !== "OTHER" || !!v.note, {
    path: ["note"],
    message: "Explain the reason when choosing Other",
  });

export const approveSchema = z.object({ campaignId: z.string().min(1, "Choose a campaign") });

/** Customer-facing reason text stored on the OfferRequest. */
export function formatRejectReason(code: RejectReasonCode, note?: string): string {
  if (code === "OTHER") return note ?? "Other";
  return note ? `${REJECT_REASONS[code]}. ${note}` : REJECT_REASONS[code];
}

export const STAFF_ROLES = ["SUPPORT", "FINANCE", "ADMIN"] as const;
export const PASSWORD_MIN = 12;

/** Create and edit share the same fields. */
export const staffCreateSchema = z.object({
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email("Enter a valid email").max(254)),
  name: z.string().trim().min(2, "Enter a name").max(80, "Name is too long"),
  role: z.enum(STAFF_ROLES),
});

/** Either an edit of the details ({ name, email, role }) or an activation change ({ active }). */
export const staffUpdateSchema = z.union([staffCreateSchema.strict(), z.object({ active: z.boolean() }).strict()]);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(200),
    newPassword: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`).max(128, "Too long"),
  })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from the current one" });
