import { NextResponse } from "next/server";

import { formatBDT } from "@/lib/money";
import type { ReviewFailure } from "@/server/services/vouchers";

export function reviewFailureResponse(f: ReviewFailure) {
  switch (f.reason) {
    case "not_found":
      return json(404, f.reason, "Request not found.");
    case "already_reviewed":
      return json(409, f.reason, `This request was already ${f.status.toLowerCase()}. Refresh to see the latest state.`);
    case "campaign_not_found":
      return json(404, f.reason, "Campaign not found.");
    case "campaign_inactive":
      return json(409, f.reason, "That campaign is not active.");
    case "campaign_not_started":
      return json(409, f.reason, "That campaign hasn't started yet.");
    case "campaign_ended":
      return json(409, f.reason, "That campaign has ended.");
    case "budget_exceeded":
      return json(409, f.reason, `Campaign budget exhausted: ${formatBDT(f.remaining)} left, voucher needs ${formatBDT(f.needed)}.`);
    case "customer_limit_reached":
      return json(409, f.reason, `This customer already has ${f.limit} voucher(s) from this campaign (the limit).`);
  }
}

function json(status: number, reason: string, error: string) {
  return NextResponse.json({ ok: false, reason, error }, { status });
}
