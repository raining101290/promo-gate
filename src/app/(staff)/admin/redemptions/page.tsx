import Link from "next/link";

import { FraudBadges } from "@/components/staff/fraud-badges";
import { HelpLink } from "@/components/staff/help-link";
import { ReceiptThumb } from "@/components/staff/receipt-thumb";
import { selectClass } from "@/components/staff/form-styles";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RedemptionStatus } from "@/generated/prisma/client";
import { formatBDT } from "@/lib/money";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listPartnersWithBranches, listRedemptionQueue, QUEUE_PAGE_SIZE } from "@/server/services/redemption-review";

export const metadata = { title: "Redemptions" };

type Search = {
  tab?: string;
  partner?: string;
  branch?: string;
  from?: string;
  to?: string;
  page?: string;
};

const TABS: {
  key: string;
  label: string;
  status?: RedemptionStatus;
  flagged?: boolean;
}[] = [
  { key: "review", label: "To review", status: "RECEIPT_UPLOADED" },
  { key: "no-receipt", label: "No receipt yet", status: "CLAIMED" },
  { key: "flagged", label: "No receipt 24h+", flagged: true },
  { key: "disputed", label: "Disputed", status: "DISPUTED" },
  { key: "verified", label: "Verified", status: "VERIFIED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "all", label: "All" },
];

const isDay = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function RedemptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage(PERMISSIONS.viewRedemptions, "/admin/redemptions");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const filters = {
    partner: sp.partner || undefined,
    branch: sp.branch || undefined,
    from: isDay(sp.from),
    to: isDay(sp.to),
  };
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [partners, queue] = await Promise.all([
    listPartnersWithBranches(),
    listRedemptionQueue({
      status: tab.status,
      flagged: tab.flagged,
      partnerId: filters.partner,
      branchId: filters.branch,
      from: filters.from,
      to: filters.to,
      page,
    }),
  ]);

  const href = (over: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { tab: tab.key, ...filters, ...over } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/redemptions?${q}`;
  };
  const allCount = Object.values(queue.statusCounts).reduce((a, b) => a + (b ?? 0), 0);
  const countFor = (t: (typeof TABS)[number]) => (t.flagged ? queue.flaggedCount : t.status ? (queue.statusCounts[t.status] ?? 0) : allCount);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Redemptions</h1>
          <HelpLink slug="redemptions" />
        </div>
        <p className="text-muted-foreground text-sm">Check receipts and verify redemptions. Verified ones become ready to pay in Settlements.</p>
      </div>

      <form action="/admin/redemptions" className="flex flex-wrap items-end gap-3" role="search">
        <input type="hidden" name="tab" value={tab.key} />
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Partner</span>
          <select name="partner" defaultValue={filters.partner ?? ""} className={cn(selectClass, "w-48")}>
            <option value="">All partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">Branch</span>
          <select name="branch" defaultValue={filters.branch ?? ""} className={cn(selectClass, "w-52")}>
            <option value="">All branches</option>
            {partners.map((p) => (
              <optgroup key={p.id} label={p.name}>
                {p.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">From (Dhaka)</span>
          <Input type="date" name="from" defaultValue={filters.from} className="w-40" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground block text-xs">To (Dhaka)</span>
          <Input type="date" name="to" defaultValue={filters.to} className="w-40" />
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(filters.partner || filters.branch || filters.from || filters.to) && (
          <Button asChild variant="ghost">
            <Link href={`/admin/redemptions?tab=${tab.key}`}>Clear</Link>
          </Button>
        )}
      </form>

      <nav className="flex flex-wrap gap-1 border-b" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key, page: undefined })}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t.key === tab.key ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
              t.flagged && countFor(t) > 0 && "text-amber-700 dark:text-amber-300",
            )}
          >
            {t.label} <span className="ml-1 tabular-nums opacity-70">{countFor(t)}</span>
          </Link>
        ))}
      </nav>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date (Dhaka)</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Bill</TableHead>
              <TableHead className="text-right">Voucher</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                  Nothing here.
                </TableCell>
              </TableRow>
            ) : (
              queue.rows.map((r) => (
                <TableRow key={r.id} className={r.flagged ? "bg-amber-50/60 dark:bg-amber-950/30" : undefined}>
                  <TableCell className="tabular-nums">
                    <div>{formatDhakaDateTime(r.redeemedAt)}</div>
                    <div className="text-muted-foreground font-mono text-xs">{redemptionRef(r.id)}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.customer.email}</div>
                    <div className="text-muted-foreground text-xs">{r.customer.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div>{r.branch.partner.name}</div>
                    <div className="text-muted-foreground text-xs">{r.branch.name}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatBDT(r.billAmount)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatBDT(r.discountAmount)}</TableCell>
                  <TableCell>
                    <ReceiptThumb redemptionId={r.id} hasReceipt={r.hasReceipt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={r.status} />
                      {r.flagged && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">No receipt after 24h</span>}
                      {r.settlementId && <span className="text-muted-foreground text-xs">In settlement</span>}
                      <FraudBadges signals={r.signals} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant={r.status === "RECEIPT_UPLOADED" ? "default" : "outline"}>
                      <Link href={`/admin/redemptions/${r.id}`}>{r.status === "RECEIPT_UPLOADED" ? "Review" : "Open"}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {queue.total === 0 ? 0 : (page - 1) * QUEUE_PAGE_SIZE + 1}–{Math.min(page * QUEUE_PAGE_SIZE, queue.total)} of {queue.total}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: String(page - 1) })}>Previous</Link>
            </Button>
          )}
          {page < queue.pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: String(page + 1) })}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
