import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/customer/site-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatBDT } from "@/lib/money";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { getCustomerRedemptionDetail } from "@/server/services/customer-portal";

import { ReceiptUploader } from "./receipt-uploader";

export const metadata: Metadata = { title: "Receipt · Hosting.com Coffee Campaign" };

export default async function RedemptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/dashboard/redemptions/${id}`)}`);
  const r = await getCustomerRedemptionDetail(session.sub, id);
  if (!r) notFound();

  const canUpload = r.status === "CLAIMED" || r.status === "RECEIPT_UPLOADED";

  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn />
      <main className="mx-auto w-full max-w-md space-y-5 px-4 pt-4 pb-12">
        <Link href="/dashboard" className="text-muted-foreground inline-block py-2 text-sm">
          ← My vouchers
        </Link>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight">{r.branch.partner.name}</h1>
                <p className="text-muted-foreground text-sm">
                  {r.branch.name} · {formatDhakaDateTime(r.redeemedAt)}
                </p>
              </div>
              <StatusBadge status={r.status} className="shrink-0" />
            </div>
            <dl className="space-y-1 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Bill</dt>
                <dd>{formatBDT(r.billAmount)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Voucher paid</dt>
                <dd>{formatBDT(r.discountAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">You paid</dt>
                <dd>{formatBDT(r.customerPaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono">{redemptionRef(r.id)}</dd>
              </div>
              {r.posReceiptNo && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">POS receipt no.</dt>
                  <dd className="font-mono">{r.posReceiptNo}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {canUpload ? (
          <ReceiptUploader redemptionId={r.id} alreadyUploaded={r.status === "RECEIPT_UPLOADED"} initialPosReceiptNo={r.posReceiptNo ?? ""} />
        ) : (
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              {r.status === "VERIFIED"
                ? "Thanks! Your receipt has been checked."
                : r.status === "DISPUTED"
                  ? "Our team is looking into this redemption and may contact you."
                  : "This redemption was not accepted. Contact support if you think this is a mistake."}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
