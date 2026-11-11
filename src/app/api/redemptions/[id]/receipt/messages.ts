import { NextResponse } from "next/server";

import type { ReceiptFailure } from "@/server/services/receipts";

const MESSAGES: Record<ReceiptFailure["reason"], [number, string]> = {
  not_found: [404, "Redemption not found."],
  not_uploadable: [409, "This redemption has already been reviewed; the receipt can't be changed."],
  rate_limited: [429, "Too many uploads. Try again later."],
  bad_key: [400, "Invalid upload."],
  missing: [409, "The upload didn't arrive. Please try again."],
  too_large: [413, "Photo must be 8 MB or smaller."],
  bad_type: [415, "That file isn't a JPEG, PNG or HEIC photo."],
  state_changed: [409, "This redemption changed while uploading. Refresh and try again."],
};

export function receiptFailure(f: ReceiptFailure) {
  const [status, error] = MESSAGES[f.reason];
  return NextResponse.json({ ok: false, reason: f.reason, error }, { status });
}
