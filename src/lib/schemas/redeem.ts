import "@/lib/zod-config";

import { z } from "zod";

import { MAX_BILL_PAISA } from "@/lib/money";
import { BRANCH_CODE_RE } from "@/lib/slug";

export const redeemPreviewSchema = z.object({
  branchCode: z.string().regex(BRANCH_CODE_RE).max(32),
  voucherId: z.string().min(1).max(64),
  /** Integer paisa, parsed client-side from the taka the customer typed (never a float). */
  billPaisa: z.number().int().positive().max(MAX_BILL_PAISA),
});

export const redeemConfirmSchema = redeemPreviewSchema.extend({
  pin: z.string().regex(/^\d{4}$/, "PIN is 4 digits"),
});
