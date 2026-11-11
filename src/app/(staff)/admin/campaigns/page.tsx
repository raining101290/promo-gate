import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT } from "@/lib/money";
import { offerConditions, offerHeadline } from "@/lib/offer";
import { formatDhakaDate } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listCampaignsWithUsage } from "@/server/services/campaigns";

import { ActiveToggle } from "./active-toggle";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requireStaffPage(PERMISSIONS.manageCampaigns, "/admin/campaigns");
  const campaigns = await listCampaignsWithUsage();
  const now = new Date();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
            <HelpLink slug="campaigns" />
          </div>
          <p className="text-muted-foreground text-sm">
            Issued = face value of vouchers handed out (counts against the budget). Redeemed = what was actually used at cafés.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">New campaign</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Active campaign budgets" data-testid="budget-cards">
        {campaigns
          .filter((c) => c.active)
          .map((c) => {
            const cap = c.totalBudget;
            const pct = (n: number) => (cap ? Math.min(100, (n / cap) * 100) : 0);
            return (
              <div key={c.id} className="space-y-3 rounded-lg border p-4" data-testid="budget-card">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{c.name}</p>
                  <span className="text-muted-foreground shrink-0 text-xs">{cap == null ? "no budget cap" : `budget ${formatBDT(cap)}`}</span>
                </div>
                {cap != null && (
                  <div className="bg-muted relative h-2.5 overflow-hidden rounded-full" aria-hidden>
                    <div className="absolute inset-y-0 left-0 bg-sky-300 dark:bg-sky-800" style={{ width: `${pct(c.committed)}%` }} />
                    <div className="bg-primary absolute inset-y-0 left-0" style={{ width: `${pct(c.redeemed)}%` }} />
                  </div>
                )}
                <dl className="grid grid-cols-3 gap-2 text-sm tabular-nums">
                  <div>
                    <dt className="text-muted-foreground text-xs">Issued</dt>
                    <dd className="font-semibold">{formatBDT(c.committed)}</dd>
                    <dd className="text-muted-foreground text-xs">{c.issued} vouchers</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Redeemed</dt>
                    <dd className="font-semibold">{formatBDT(c.redeemed)}</dd>
                    <dd className="text-muted-foreground text-xs">{c.redeemedCount} uses</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Left to issue</dt>
                    <dd className="font-semibold">{cap == null ? "∞" : formatBDT(Math.max(0, cap - c.committed))}</dd>
                    {cap != null && c.committed >= cap && <dd className="text-xs font-medium text-red-700 dark:text-red-400">Approvals blocked</dd>}
                  </div>
                </dl>
              </div>
            );
          })}
      </section>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead className="text-right">Vouchers</TableHead>
              <TableHead>Budget committed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No campaigns yet.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => {
                const window = c.startsAt > now ? "Scheduled" : c.endsAt && c.endsAt <= now ? "Ended" : null;
                const pct = c.totalBudget ? Math.min(100, Math.round((c.committed / c.totalBudget) * 100)) : null;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-muted-foreground text-xs tabular-nums">
                        {formatDhakaDate(c.startsAt)} – {c.endsAt ? formatDhakaDate(c.endsAt) : "no end"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{offerHeadline(c)}</div>
                      <div className="text-muted-foreground text-xs">
                        {[...offerConditions(c), `${c.validityDays}-day vouchers`, c.perCustomerLimit ? `max ${c.perCustomerLimit}/customer` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.issued}</TableCell>
                    <TableCell className="w-44">
                      {c.totalBudget == null ? (
                        <span className="tabular-nums">{formatBDT(c.committed)} · no cap</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="tabular-nums">
                            {formatBDT(c.committed)} / {formatBDT(c.totalBudget)}
                          </div>
                          <div className="bg-muted h-1.5 rounded-full" aria-hidden>
                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Active" : "Inactive"}</Badge>
                        {window && <Badge variant="outline">{window}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/campaigns/${c.id}/edit`}>Edit</Link>
                        </Button>
                        <ActiveToggle id={c.id} active={c.active} name={c.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
