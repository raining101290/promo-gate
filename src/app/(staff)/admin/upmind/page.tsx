import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { upmindOverview } from "@/server/services/upmind";

import { RetryDeliveryButton } from "./retry-button";

export const metadata = { title: "Upmind" };

const OUTCOME: Record<string, { label: string; tone: string }> = {
  issued: { label: "Voucher issued", tone: "text-emerald-700 dark:text-emerald-400" },
  already_issued: { label: "Repeat (already issued)", tone: "text-muted-foreground" },
  pending_review: { label: "Waiting for support", tone: "text-amber-700 dark:text-amber-400" },
  rejected: { label: "Rejected earlier", tone: "text-muted-foreground" },
  conflict: { label: "Invoice already used", tone: "text-red-700 dark:text-red-400" },
  invalid: { label: "Invalid data", tone: "text-red-700 dark:text-red-400" },
  unauthorized: { label: "Wrong validatedCode", tone: "text-red-700 dark:text-red-400" },
};

const REASON: Record<string, string> = {
  no_auto_campaign: "no campaign is marked “Use for Upmind”",
  contact_conflict: "the phone belongs to another account",
  budget_exceeded: "campaign budget used up",
  customer_limit_reached: "customer limit reached",
  campaign_inactive: "campaign inactive",
  campaign_not_started: "campaign not started",
  campaign_ended: "campaign ended",
  awaiting_review: "still waiting for support",
};

export default async function UpmindPage() {
  const staff = await requireStaffPage(PERMISSIONS.viewUpmind, "/admin/upmind");
  const canRetry = (PERMISSIONS.retryUpmind as readonly string[]).includes(staff.role);
  const o = await upmindOverview();

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Upmind</h1>
          <HelpLink slug="upmind" />
        </div>
        <p className="text-muted-foreground text-sm">
          Upmind (hosting.com billing) sends every paid invoice here, and we tell Upmind when a voucher is redeemed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="upmind-status">
        <Card title="Receiving invoices">
          <p className="text-lg font-semibold">{o.configured ? "On" : "Off"}</p>
          <p className="text-muted-foreground text-xs">{o.configured ? "Shared secret is set" : "Set UPMIND_SECRET on the server"}</p>
        </Card>
        <Card title="Vouchers issued from" warn={!o.campaign}>
          {o.campaign ? (
            <>
              <p className="truncate text-lg font-semibold" title={o.campaign.name}>
                {o.campaign.name}
              </p>
              <Link href="/admin/campaigns" className="text-muted-foreground text-xs underline underline-offset-4">
                Change in Campaigns
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">No campaign</p>
              <p className="text-xs">
                Paid invoices wait in Requests.{" "}
                <Link href="/admin/campaigns" className="underline underline-offset-4">
                  Pick one in Campaigns
                </Link>
              </p>
            </>
          )}
        </Card>
        <Card title="Redemption callbacks to">
          <p className="truncate text-lg font-semibold">{o.callbackHost ?? "—"}</p>
          <p className="text-muted-foreground text-xs">{o.callbackHost ? "UPMIND_REDEMPTION_URL" : "Set UPMIND_REDEMPTION_URL (https)"}</p>
        </Card>
        <Card title="Callbacks waiting / failed" warn={o.failed > 0}>
          <p className="text-lg font-semibold tabular-nums">
            {o.pending} / {o.failed}
          </p>
          <p className="text-muted-foreground text-xs">Retried automatically every hour</p>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Redemption callbacks</h2>
        <p className="text-muted-foreground text-sm">Sent to Upmind when a voucher from an Upmind invoice is redeemed. Latest 30.</p>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Redeemed (Dhaka)</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Redemption</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Upmind replied</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.deliveries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No redemptions of Upmind vouchers yet.
                  </TableCell>
                </TableRow>
              )}
              {o.deliveries.map((d) => (
                <TableRow key={d.id} data-testid="upmind-delivery">
                  <TableCell className="whitespace-nowrap">{formatDhakaDateTime(d.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.invoiceNumber}</TableCell>
                  <TableCell>
                    <Link href={`/admin/redemptions/${d.redemptionId}`} className="font-mono text-xs underline underline-offset-4">
                      {redemptionRef(d.redemptionId)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                    <span className="text-muted-foreground block text-xs">
                      {d.status === "SENT" && d.sentAt
                        ? formatDhakaDateTime(d.sentAt)
                        : `${d.attempts} attempt${d.attempts === 1 ? "" : "s"}${d.status === "PENDING" ? ` · next ${formatDhakaDateTime(d.nextAttemptAt)}` : ""}`}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-sm text-xs break-words whitespace-normal">
                    {d.lastError ?? (d.lastStatus ? `HTTP ${d.lastStatus}` : <span className="text-muted-foreground">—</span>)}
                  </TableCell>
                  <TableCell className="text-right">{canRetry && d.status !== "SENT" && <RetryDeliveryButton id={d.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Paid invoices received</h2>
        <p className="text-muted-foreground text-sm">Every call Upmind made to us, latest 30. Contact details aren&apos;t logged here; open the request for them.</p>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received (Dhaka)</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Reply</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.inbound.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                    Nothing received from Upmind yet.
                  </TableCell>
                </TableRow>
              )}
              {o.inbound.map((r) => {
                const out = OUTCOME[r.outcome] ?? { label: r.outcome, tone: "" };
                return (
                  <TableRow key={r.id} data-testid="upmind-inbound">
                    <TableCell className="whitespace-nowrap">{formatDhakaDateTime(r.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.offerRequestId ? (
                        <Link href={`/admin/requests/${r.offerRequestId}`} className="underline underline-offset-4">
                          {r.invoiceNumber}
                        </Link>
                      ) : (
                        (r.invoiceNumber ?? "—")
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn("font-medium", out.tone)}>{out.label}</span>
                      {r.detail && <span className="text-muted-foreground block text-xs">{REASON[r.detail] ?? r.detail}</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">HTTP {r.httpStatus}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, warn, children }: { title: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border p-4", warn && "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40")}>
      <p className="text-muted-foreground text-xs font-medium uppercase">{title}</p>
      {children}
    </div>
  );
}
