import Link from "next/link";

import { offerConditions, offerHeadline } from "@/lib/offer";
import { expiresInLabel, formatDhakaDate } from "@/lib/time";
import type { CustomerVoucher } from "@/server/services/customer-portal";

/** Large tappable card for an active voucher. */
export function ActiveVoucherCard({ voucher, now }: { voucher: CustomerVoucher; now: Date }) {
  const conditions = offerConditions(voucher.terms);
  return (
    <Link
      href={`/dashboard/vouchers/${voucher.id}`}
      className="bg-primary text-primary-foreground focus-visible:ring-ring block rounded-xl p-4 shadow-sm transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight">{offerHeadline(voucher.terms)}</p>
          <p className="truncate text-sm opacity-80">{voucher.campaignName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">Active</span>
      </div>
      {conditions.length > 0 && <p className="mt-3 text-sm opacity-90">{conditions.join(" · ")}</p>}
      <div className="mt-4 flex items-end justify-between gap-3 text-sm">
        <div>
          <p className="font-medium">{expiresInLabel(voucher.expiresAt, now)}</p>
          <p className="text-xs opacity-70">Valid until {formatDhakaDate(voucher.expiresAt)}</p>
        </div>
        <span className="shrink-0 font-medium underline-offset-4">Use voucher →</span>
      </div>
    </Link>
  );
}
