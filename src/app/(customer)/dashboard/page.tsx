import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/customer/site-header";
import { StatusBadge } from "@/components/status-badge";
import { ActiveVoucherCard } from "@/components/customer/voucher-card";
import { Card, CardContent } from "@/components/ui/card";
import { offerHeadline } from "@/lib/offer";
import { formatDhakaDate } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { getCustomerDashboard } from "@/server/services/customer-portal";

export const metadata: Metadata = { title: "My vouchers · Hosting.com Coffee Campaign" };

export default async function DashboardPage() {
  // Middleware guards this route; re-check here (defence in depth).
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/dashboard");

  const now = new Date();
  const data = await getCustomerDashboard(session.sub, now);
  if (!data) redirect("/login");
  const receiptsNeeded = data.pastVouchers.filter((v) => v.redemptionStatus === "CLAIMED" && v.redemptionId);

  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn />
      <main className="mx-auto w-full max-w-md space-y-8 px-4 pt-6 pb-12">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Hi {data.name ?? "there"}</h1>
          <p className="text-muted-foreground truncate text-sm" data-testid="signed-in-as">
            Signed in as {data.email}
          </p>
        </section>

        {receiptsNeeded.length > 0 && (
          <section aria-labelledby="receipts-heading" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950" data-testid="receipt-reminder">
            <h2 id="receipts-heading" className="flex items-center gap-2 font-semibold text-amber-950 dark:text-amber-100">
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">{receiptsNeeded.length}</span>
              Receipt photo needed
            </h2>
            <p className="text-sm text-amber-900 dark:text-amber-200">Upload a photo of the café&apos;s printed receipt so we can settle with them.</p>
            <ul className="space-y-2">
              {receiptsNeeded.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/dashboard/redemptions/${v.redemptionId}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 text-sm font-medium shadow-xs dark:bg-black/30"
                  >
                    <span className="min-w-0 truncate">
                      {offerHeadline(v.terms)} · {v.redeemedAtBranch}
                    </span>
                    <span className="shrink-0 underline underline-offset-4">Upload</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="text-lg font-semibold">
            Active vouchers
          </h2>
          {data.activeVouchers.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground text-sm">
                No active vouchers yet. Once support approves an invoice, your voucher appears here.
              </CardContent>
            </Card>
          ) : (
            data.activeVouchers.map((v) => <ActiveVoucherCard key={v.id} voucher={v} now={now} />)
          )}
        </section>

        <section aria-labelledby="requests-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="requests-heading" className="text-lg font-semibold">
              Your invoices
            </h2>
            <Link href="/#submit" className="text-sm font-medium underline underline-offset-4">
              Submit another
            </Link>
          </div>
          {data.requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">You haven&apos;t submitted any invoices yet.</p>
          ) : (
            <Card className="py-0">
              <ul className="divide-y" data-testid="requests">
                {data.requests.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-medium">{r.invoiceNumber}</p>
                        <p className="text-muted-foreground text-xs">Submitted {formatDhakaDate(r.createdAt)}</p>
                      </div>
                      <StatusBadge status={r.status} className="shrink-0" />
                    </div>
                    {r.status === "REJECTED" && (
                      <p className="text-muted-foreground mt-2 text-sm">
                        <span className="text-foreground font-medium">Reason:</span> {r.rejectReason ?? "Not provided"}
                      </p>
                    )}
                    {r.status === "PENDING" && (
                      <p className="text-muted-foreground mt-2 text-sm">We&apos;re checking this invoice. You&apos;ll get a voucher once it&apos;s approved.</p>
                    )}
                    {r.voucher && (
                      <Link href={`/dashboard/vouchers/${r.voucher.id}`} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">
                        View voucher
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {data.pastVouchers.length > 0 && (
          <section aria-labelledby="past-heading" className="space-y-3">
            <h2 id="past-heading" className="text-lg font-semibold">
              Past vouchers
            </h2>
            <Card className="py-0">
              <ul className="divide-y">
                {data.pastVouchers.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={v.redemptionId ? `/dashboard/redemptions/${v.redemptionId}` : `/dashboard/vouchers/${v.id}`}
                      className="hover:bg-accent flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{offerHeadline(v.terms)}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {v.displayStatus === "REDEEMED" && v.redeemedAt
                            ? `Used ${formatDhakaDate(v.redeemedAt)}${v.redeemedAtBranch ? ` at ${v.redeemedAtBranch}` : ""}`
                            : v.displayStatus === "EXPIRED"
                              ? `Expired ${formatDhakaDate(v.expiresAt)}`
                              : v.campaignName}
                        </p>
                      </div>
                      {/* Redeemed vouchers show the receipt state, which is what the customer can act on. */}
                      <StatusBadge status={v.redemptionStatus ?? v.displayStatus} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
        <p className="flex justify-center gap-4 text-sm">
          <Link href="/guide" className="text-muted-foreground underline underline-offset-4">
            How it works
          </Link>
          <Link href="/dashboard/account" className="text-muted-foreground underline underline-offset-4">
            Your data &amp; account
          </Link>
        </p>
      </main>
    </div>
  );
}
