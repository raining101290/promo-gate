import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { formatBDT, formatTakaAmount } from "@/lib/money";
import { redemptionRef, SUCCESS_FRESH_MS } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { getCustomerRedemption } from "@/server/services/redemptions";

import { SuccessScreen } from "./success-screen";

export const metadata: Metadata = { title: "Voucher accepted · Hosting.com Coffee Campaign" };

/**
 * Read-only view of a redemption that already happened. Reloading never redeems again (the voucher is
 * REDEEMED), and the screen only shows the green "valid" state for SUCCESS_FRESH_MS after redeemedAt.
 */
export default async function DonePage({ params }: { params: Promise<{ branchCode: string; redemptionId: string }> }) {
  const { branchCode, redemptionId } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/r/${branchCode}/done/${redemptionId}`)}`);

  const r = await getCustomerRedemption(session.sub, redemptionId);
  if (!r || r.branch.branchCode !== branchCode) notFound();

  return (
    <SuccessScreen
      redeemedAt={r.redeemedAt.toISOString()}
      redeemedAtLabel={formatDhakaDateTime(r.redeemedAt)}
      freshUntil={new Date(r.redeemedAt.getTime() + SUCCESS_FRESH_MS).toISOString()}
      initiallyFresh={Date.now() - r.redeemedAt.getTime() < SUCCESS_FRESH_MS}
      partnerName={r.branch.partner.name}
      branchName={r.branch.name}
      bill={formatBDT(r.billAmount)}
      discount={formatBDT(r.discountAmount)}
      discountPlain={formatTakaAmount(r.discountAmount)}
      customerPaid={formatBDT(r.customerPaid)}
      reference={redemptionRef(r.id)}
      receiptHref={`/dashboard/redemptions/${r.id}`}
    />
  );
}
