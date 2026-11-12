import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { SiteHeader } from "@/components/customer/site-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { offerConditions, offerHeadline } from "@/lib/offer";
import { formatDhakaDate, formatDhakaDateTime } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { getCustomerVoucher } from "@/server/services/customer-portal";

import { ExpiryCountdown } from "./expiry-countdown";
import { RedeemButton } from "./redeem-button";

export const metadata: Metadata = { title: "Voucher · Hosting.com Coffee Campaign" };

/** "AbCdEfGh..." -> "AbCd EfGh ..." for readability */
function chunk(code: string) {
  return code.match(/.{1,4}/g)?.join(" ") ?? code;
}

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/login?next=/dashboard/vouchers/${encodeURIComponent(id)}`);

  const voucher = await getCustomerVoucher(session.sub, id);
  if (!voucher) notFound();

  const active = voucher.displayStatus === "ACTIVE";
  const conditions = offerConditions(voucher.terms);
  // Our own generated SVG (no user HTML), so inlining it is safe.
  const qrSvg = active ? await QRCode.toString(voucher.code, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn />
      <main className="mx-auto w-full max-w-md space-y-5 px-4 pt-4 pb-12">
        <Link href="/dashboard" className="text-muted-foreground inline-block py-2 text-sm">
          ← My vouchers
        </Link>

        <Card className={active ? "border-primary" : undefined}>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight">{offerHeadline(voucher.terms)}</h1>
                <p className="text-muted-foreground text-sm">{voucher.campaignName}</p>
              </div>
              <StatusBadge status={voucher.displayStatus} className="shrink-0" />
            </div>
            <ul className="text-sm">
              {conditions.map((c) => (
                <li key={c}>{c}</li>
              ))}
              <li>One use, at any partner branch</li>
              <li className="text-muted-foreground">Issued {formatDhakaDate(voucher.issuedAt)}</li>
            </ul>
          </CardContent>
        </Card>

        {active ? (
          <>
            <ExpiryCountdown expiresAt={voucher.expiresAt.toISOString()} validUntil={formatDhakaDateTime(voucher.expiresAt)} />

            <RedeemButton voucherId={voucher.id} />

            <Card>
              <CardContent className="flex flex-col items-center gap-3">
                <div
                  className="w-full max-w-60 rounded-md bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label="Voucher QR code"
                  dangerouslySetInnerHTML={{ __html: qrSvg ?? "" }}
                />
                <p className="text-muted-foreground text-center text-xs">Voucher code</p>
                <p className="text-center font-mono text-sm break-all" data-testid="voucher-code">
                  {chunk(voucher.code)}
                </p>
              </CardContent>
            </Card>

            <section className="text-sm">
              <h2 className="font-semibold">How to redeem</h2>
              <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5">
                <li>At the counter, tap “Redeem at a branch” and scan the café&apos;s QR.</li>
                <li>Enter your bill amount.</li>
                <li>Hand your phone to the cashier to enter the branch PIN.</li>
              </ol>
            </section>
          </>
        ) : (
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              {voucher.displayStatus === "REDEEMED" && voucher.redeemedAt
                ? `Used on ${formatDhakaDateTime(voucher.redeemedAt)}${voucher.redeemedAtBranch ? ` at ${voucher.redeemedAtBranch}` : ""}.`
                : voucher.displayStatus === "EXPIRED"
                  ? `This voucher expired on ${formatDhakaDateTime(voucher.expiresAt)}.`
                  : "This voucher was cancelled. Contact support if you think this is a mistake."}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
