import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OfferRequestStatus } from "@/generated/prisma/client";
import { formatDhakaDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listOfferRequests, PAGE_SIZE, STATUSES } from "@/server/services/review-queue";

export const metadata = { title: "Requests" };

type Search = { status?: string; q?: string; page?: string };

/** Default view is the work queue (PENDING). "all" shows every status. */
function parseStatus(s: string | undefined): OfferRequestStatus | undefined {
  if (s === "all") return undefined;
  const upper = (s ?? "PENDING").toUpperCase();
  return (STATUSES as string[]).includes(upper) ? (upper as OfferRequestStatus) : "PENDING";
}

function href(params: { status: string; q?: string; page?: number }) {
  const sp = new URLSearchParams();
  sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  return `/admin/requests?${sp}`;
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaffPage(PERMISSIONS.reviewRequests, "/admin/requests");
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const statusKey = status ?? "all";
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const { rows, total, pages, statusCounts } = await listOfferRequests({
    status,
    q,
    page,
  });
  const allCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const tabs = [
    ...STATUSES.map((s) => ({
      key: s,
      label: s.charAt(0) + s.slice(1).toLowerCase(),
      count: statusCounts[s],
    })),
    { key: "all", label: "All", count: allCount },
  ];
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Offer requests</h1>
            <HelpLink slug="requests" />
          </div>
          <p className="text-muted-foreground text-sm">Verify invoices and issue vouchers. Newest first.</p>
        </div>
        <form action="/admin/requests" className="flex w-full max-w-md gap-2" role="search">
          <input type="hidden" name="status" value={statusKey} />
          <Input name="q" defaultValue={q} placeholder="Invoice, email or phone" aria-label="Search requests" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {q && (
            <Button asChild variant="ghost">
              <Link href={href({ status: statusKey })}>Clear</Link>
            </Button>
          )}
        </form>
      </div>

      <nav className="flex gap-1 border-b" aria-label="Filter by status">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ status: t.key, q })}
            aria-current={t.key === statusKey ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              t.key === statusKey ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label} <span className="text-muted-foreground ml-1 tabular-nums">{t.count}</span>
          </Link>
        ))}
      </nav>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Submitted (Dhaka)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewed by</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  {q ? `No requests match “${q}”.` : "Nothing here."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.invoiceNumber}</TableCell>
                  <TableCell>
                    <div>{r.submittedEmail}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.submittedPhone}
                      {r.contactMismatch && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          contact differs from account
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDhakaDateTime(r.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.reviewedBy?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant={r.status === "PENDING" ? "default" : "outline"}>
                      <Link href={`/admin/requests/${r.id}`}>{r.status === "PENDING" ? "Review" : "View"}</Link>
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
          {from}–{to} of {total}
        </p>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ status: statusKey, q, page: page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-muted-foreground tabular-nums">
            Page {Math.min(page, pages)} of {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ status: statusKey, q, page: page + 1 })}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
