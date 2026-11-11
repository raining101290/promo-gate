import "@/lib/zod-config";

import { z } from "zod";

import { normalizeBdPhone } from "@/lib/phone";
import { BRANCH_CODE_MAX, BRANCH_CODE_RE } from "@/lib/slug";

import { bdPhoneSchema } from "./offer-request";

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);

export const partnerInputSchema = z
  .object({
    name: text(2, 80, "Name"),
    contactName: text(2, 80, "Contact name"),
    contactPhone: bdPhoneSchema,
    payoutMethod: z.enum(["BANK", "BKASH"]),
    payoutAccount: text(4, 200, "Payout account"),
    contractStatus: z.enum(["ACTIVE", "PAUSED", "ENDED"]),
  })
  .transform((p, ctx) => {
    // A bKash account is a mobile number: store it E.164 like every other phone.
    if (p.payoutMethod !== "BKASH") return p;
    const phone = normalizeBdPhone(p.payoutAccount);
    if (!phone) {
      ctx.addIssue({ code: "custom", path: ["payoutAccount"], message: "bKash account must be a BD mobile number" });
      return z.NEVER;
    }
    return { ...p, payoutAccount: phone };
  });

export type PartnerInput = z.output<typeof partnerInputSchema>;

const branchFields = {
  name: text(2, 60, "Branch name"),
  area: text(2, 60, "Area"),
  address: text(5, 300, "Address"),
  smsPhone: bdPhoneSchema,
};

export const branchCreateSchema = z.object({
  ...branchFields,
  /** Optional: blank means "generate from partner + branch name". Immutable after creation. */
  branchCode: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || undefined)
    .pipe(
      z
        .string()
        .min(3, "Code must be at least 3 characters")
        .max(BRANCH_CODE_MAX, `Code must be at most ${BRANCH_CODE_MAX} characters`)
        .regex(BRANCH_CODE_RE, "Use lowercase letters, numbers and single hyphens, e.g. northend-gulshan2")
        .optional(),
    ),
});

/** Edit: branchCode deliberately absent (immutable: it is printed on the standee QR). */
export const branchUpdateSchema = z.object({ ...branchFields, active: z.boolean() });

export const branchActiveSchema = z.object({ active: z.boolean() });

export type BranchCreateInput = z.output<typeof branchCreateSchema>;
export type BranchUpdateInput = z.output<typeof branchUpdateSchema>;
