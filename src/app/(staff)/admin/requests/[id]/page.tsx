import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT } from "@/lib/money";
import { offerConditions, offerHeadline } from "@/lib/offer";
import { REJECT_REASONS } from "@/lib/schemas/staff";
import { formatDhakaDate, formatDhakaDateTime } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listIssuableCampaigns } from "@/server/services/campaigns";
import { getOfferRequestForReview } from "@/server/services/review-queue";

import { ReviewPanel } from "./review-panel";

export const metadata = { title: "Review request" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Mismatch({ show, account }: { show: boolean; account: string }) {
  if (!show) return null;
  return (
    <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">
      Differs from the account on file ({account}). Check it matches the invoice.
    </span>
  );
}

export default async function ReviewRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(PERMISSIONS.reviewRequests, `/admin/requests/${id}`);

  const data = await getOfferRequestForReview(id);
  if (!data) notFound();
  const { request, previous, emailMismatch, phoneMismatch } = data;
  const { customer } = request;

  const campaigns =
    request.status === "PENDING"
      ? (await listIssuableCampaigns()).map((c) => ({
          id: c.id,
          name: c.name,
          headline: offerHeadline(c),
          conditions: offerConditions(c),
          validityDays: c.validityDays,
          remaining: c.totalBudget == null ? null : formatBDT(Math.max(0, c.totalBudget - c.committed)),
          perCustomerLimit: c.perCustomerLimit,
        }))
      : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/requests" className="text-muted-foreground text-sm hover:underline">
          ← All requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">{request.invoiceNumber}</h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="text-muted-foreground text-sm">Submitted {formatDhakaDateTime(request.createdAt)} (Dhaka)</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-6 2xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submitted with the invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Invoice number">
                    <span className="font-mono">{request.invoiceNumber}</span>
                  </Row>
                  <Row label="Email">
                    {request.submittedEmail}
                    <Mismatch show={emailMismatch} account={customer.email} />
                  </Row>
                  <Row label="Phone">
                    {request.submittedPhone}
                    <Mismatch show={phoneMismatch} account={customer.phone} />
                  </Row>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer account</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Name">{customer.name ?? <span className="text-muted-foreground">Not set</span>}</Row>
                  <Row label="Email">{customer.email}</Row>
                  <Row label="Phone">{customer.phone}</Row>
                  <Row label="Customer since">{formatDhakaDate(customer.createdAt)}</Row>
                  <Row label="History">
                    {previous.length + 1} request(s) · {customer._count.vouchers} voucher(s) · {customer._count.redemptions} redemption(s)
                  </Row>
                </dl>
              </CardContent>
            </Card>
          </div>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Previous requests by this customer</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previous.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground h-16 text-center">
                        First request from this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previous.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">
                          <Link href={`/admin/requests/${p.id}`} className="hover:underline">
                            {p.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDhakaDate(p.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {p.voucher ? `${p.voucher.campaign.name} · voucher ${p.voucher.status.toLowerCase()}` : (p.rejectReason ?? "—")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {request.status === "PENDING" ? (
            <ReviewPanel
              requestId={request.id}
              campaigns={campaigns}
              rejectReasons={Object.entries(REJECT_REASONS).map(([code, label]) => ({ code, label }))}
              reviewerName={staff.name}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review outcome</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Row label="Decision">
                    <StatusBadge status={request.status} />
                  </Row>
                  <Row label="Reviewed by">{request.reviewedBy?.name ?? "—"}</Row>
                  <Row label="Reviewed at">{request.reviewedAt ? formatDhakaDateTime(request.reviewedAt) : "—"}</Row>
                  {request.status === "REJECTED" && <Row label="Reason">{request.rejectReason}</Row>}
                  {request.voucher && (
                    <>
                      <Row label="Campaign">{request.voucher.campaign.name}</Row>
                      <Row label="Offer">{offerHeadline(request.voucher)}</Row>
                      <Row label="Voucher">
                        <StatusBadge status={request.voucher.status} />
                      </Row>
                      <Row label="Expires">{formatDhakaDateTime(request.voucher.expiresAt)}</Row>
                      {/* Only the tail: the full code is a bearer credential and stays with the customer. */}
                      <Row label="Code">
                        <span className="font-mono">…{request.voucher.code.slice(-6)}</span>
                      </Row>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
