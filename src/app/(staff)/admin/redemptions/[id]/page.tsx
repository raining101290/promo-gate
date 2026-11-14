import Link from "next/link";
import { notFound } from "next/navigation";

import { FraudBadges } from "@/components/staff/fraud-badges";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBDT } from "@/lib/money";
import { offerConditions, offerHeadline } from "@/lib/offer";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getRedemptionForStaff, noReceiptCutoff } from "@/server/services/redemption-review";

import { RedemptionReviewPanel } from "./review-panel";

export const metadata = { title: "Redemption" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function RedemptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(PERMISSIONS.viewRedemptions, `/admin/redemptions/${id}`);
  const r = await getRedemptionForStaff(id);
  if (!r) notFound();

  const canReview = (PERMISSIONS.verifyRedemptions as readonly string[]).includes(staff.role);
  const reviewable = !r.settlementId && ["CLAIMED", "RECEIPT_UPLOADED", "DISPUTED"].includes(r.status);
  const flagged = r.status === "CLAIMED" && r.redeemedAt < noReceiptCutoff();
  const receiptSrc = `/api/admin/redemptions/${r.id}/receipt`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/redemptions" className="text-muted-foreground text-sm hover:underline">
          ← Redemptions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{redemptionRef(r.id)}</h1>
          <StatusBadge status={r.status} />
          {flagged && <span className="text-sm font-medium text-amber-700 dark:text-amber-300">No receipt after 24h</span>}
        </div>
        <p className="text-muted-foreground text-sm">
          {r.branch.partner.name} · {r.branch.name} · {formatDhakaDateTime(r.redeemedAt)} (Dhaka)
        </p>
        {r.signals.length > 0 && (
          <div className="mt-2 space-y-1">
            <FraudBadges signals={r.signals} />
            <ul className="text-muted-foreground text-xs">
              {r.signals.map((s) => (
                <li key={s.code}>{s.detail}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="min-h-96">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Receipt photo</CardTitle>
            {r.receiptImageKey && (
              <a href={receiptSrc} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4">
                Open full size
              </a>
            )}
          </CardHeader>
          <CardContent>
            {r.receiptImageKey ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URL (audited view)
              <img
                src={receiptSrc}
                alt="POS receipt uploaded by the customer"
                className="bg-muted mx-auto max-h-[70vh] rounded-md border object-contain"
                data-testid="receipt-image"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex h-80 items-center justify-center rounded-md text-sm">No receipt uploaded yet.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Amounts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="tabular-nums">
                <Row label="Bill">{formatBDT(r.billAmount)}</Row>
                <Row label="Voucher (we reimburse)">
                  <strong className="text-base">{formatBDT(r.discountAmount)}</strong>
                </Row>
                <Row label="Customer paid">{formatBDT(r.customerPaid)}</Row>
                <Row label="POS receipt no.">{r.posReceiptNo ?? <span className="text-muted-foreground">not given</span>}</Row>
                {r.upmind && (
                  <Row label="Upmind told">
                    <Link href="/admin/upmind" className="underline underline-offset-4" data-testid="upmind-callback">
                      {r.upmind.status === "SENT" && r.upmind.sentAt
                        ? `yes, ${formatDhakaDateTime(r.upmind.sentAt)}`
                        : r.upmind.status === "FAILED"
                          ? `failed after ${r.upmind.attempts} tries`
                          : "not yet (retrying)"}
                    </Link>
                  </Row>
                )}
              </dl>
              <p className="text-muted-foreground mt-2 text-xs">
                Check the receipt shows this bill total and a “Hosting.com Voucher” payment of {formatBDT(r.discountAmount)}.
              </p>
            </CardContent>
          </Card>

          {canReview && reviewable ? (
            <RedemptionReviewPanel redemptionId={r.id} hasReceipt={!!r.receiptImageKey} status={r.status} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Status">
                    <StatusBadge status={r.status} />
                  </Row>
                  {r.verifiedBy && <Row label="Verified by">{r.verifiedBy.name}</Row>}
                  {r.reviewedAt && <Row label="Reviewed">{formatDhakaDateTime(r.reviewedAt)}</Row>}
                  {r.status === "VERIFIED" && !r.receiptImageKey && <Row label="Receipt">verified without receipt</Row>}
                  {r.reviewNote && <Row label={r.status === "VERIFIED" ? "How confirmed" : "Reason"}>{r.reviewNote}</Row>}
                  {r.settlement && (
                    <Row label="Settlement">
                      <Link href={`/admin/settlements/${r.settlement.id}`} className="underline underline-offset-4">
                        {r.settlement.status.toLowerCase()}
                      </Link>
                    </Row>
                  )}
                </dl>
                {!canReview && reviewable && <p className="text-muted-foreground mt-2 text-xs">Support or admin staff verify redemptions.</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <Row label="Customer">
                  {r.customer.email}
                  <br />
                  <span className="text-muted-foreground text-xs">{r.customer.phone}</span>
                </Row>
                <Row label="Branch code">
                  <span className="font-mono">{r.branch.branchCode}</span>
                </Row>
                <Row label="Voucher">
                  {offerHeadline(r.voucher)} <span className="text-muted-foreground text-xs">{offerConditions(r.voucher).join(" · ")}</span>
                </Row>
                <Row label="Campaign">{r.voucher.campaign.name}</Row>
                <Row label="Branch SMS">
                  {r.smsLogs
                    .filter((l) => l.purpose === "branch_redemption")
                    .map((l) => `${l.status.toLowerCase()} (try ${l.attempt})`)
                    .join(", ") || "—"}
                </Row>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
