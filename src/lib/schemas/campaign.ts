import "@/lib/zod-config";

import { z } from "zod";

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

/** API input for create/edit. Money in paisa, percentages in basis points, dates as ISO strings. */
export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(3, "Name is too short").max(80, "Name is too long"),
    offerType: z.enum(["FIXED", "PERCENT"]),
    value: int(1, 100_000_000),
    maxDiscount: int(1, 100_000_000).nullable(),
    minBill: int(1, 100_000_000).nullable(),
    validityDays: int(1, 365),
    totalBudget: int(1, 10_000_000_000).nullable(),
    perCustomerLimit: int(1, 100).nullable(),
    startsAt: isoDate,
    endsAt: isoDate.nullable(),
  })
  .superRefine((c, ctx) => {
    if (c.offerType === "FIXED" && c.value < 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Fixed amount must be at least ৳1" });
    }
    if (c.offerType === "PERCENT") {
      if (c.value > 10_000) ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage must be 100% or less" });
      // A cap is required: it bounds the voucher's face value, which the budget check sums.
      if (c.maxDiscount == null) {
        ctx.addIssue({ code: "custom", path: ["maxDiscount"], message: "Percent offers need a maximum discount" });
      }
    }
    if (c.offerType === "FIXED" && c.maxDiscount != null) {
      ctx.addIssue({ code: "custom", path: ["maxDiscount"], message: "Max discount only applies to percent offers" });
    }
    if (c.endsAt && c.endsAt <= c.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after start" });
    }
  });

export type CampaignInput = z.output<typeof campaignInputSchema>;

export const campaignActiveSchema = z.object({ active: z.boolean() });
/** Mark (or unmark) the campaign Upmind paid-invoice vouchers are issued from. */
export const campaignAutoIssueSchema = z.object({ autoIssue: z.boolean() });
