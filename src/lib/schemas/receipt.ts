import "@/lib/zod-config";

import { z } from "zod";

export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
export const RECEIPT_MAX_EDGE_PX = 1600;

/** Accepted upload types -> file extension. Client-side compression normally produces JPEG. */
export const RECEIPT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;
export type ReceiptContentType = keyof typeof RECEIPT_TYPES;

export const receiptUploadRequestSchema = z.object({
  contentType: z.enum(Object.keys(RECEIPT_TYPES) as [ReceiptContentType, ...ReceiptContentType[]], {
    message: "Only JPEG, PNG or HEIC photos",
  }),
  size: z.number().int().positive().max(RECEIPT_MAX_BYTES, "Photo must be 8 MB or smaller"),
});

export const receiptCompleteSchema = z.object({
  key: z.string().min(10).max(200),
  posReceiptNo: z
    .string()
    .trim()
    .max(40, "Receipt number is too long")
    .regex(/^[A-Za-z0-9 #./-]*$/, "Use letters, numbers and - / # . only")
    .optional()
    .transform((v) => v || undefined),
});
