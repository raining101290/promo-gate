import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT } from "@/lib/money";
import { formatDhakaDate, toDhakaDateInput } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listSettlements, periodLastInstant, readyToPayByPartner } from "@/server/services/settlements";

import { CreateDraftForm } from "./create-draft-form";

export const metadata = { title: "Settlements" };

export default async function SettlementsPage() {
  const staff = await requireStaffPage(PERMISSIONS.viewSettlements, "/admin/settlements");
  const canManage = (PERMISSIONS.manageSettlements as readonly string[]).includes(staff.role);
  const [ready, settlements] = await Promise.all([readyToPayByPartner(), listSettlements()]);
  const readyTotal = ready.reduce((n, r) => n + r.total, 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Settlements</h1>
          <HelpLink slug="settlements" />
        </div>
        <p className="text-muted-foreground text-sm">Reimburse partners for verified voucher redemptions. Drafts need approval by a second person.</p>
      </div>

      <section className="space-y-3" aria-labelledby="ready-h">
        <div className="flex items-baseline justify-between">
          <h2 id="ready-h" className="text-lg font-semibold">
            Ready to pay
          </h2>
          <p className="text-sm">
            Total{" "}
            <span className="font-semibold tabular-nums" data-testid="ready-total">
              {formatBDT(readyTotal)}
            </span>
          </p>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Redemptions</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Redeemed between</TableHead>
                {canManage && <TableHead>Create draft for period (Dhaka)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ready.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-muted-foreground h-16 text-center">
                    Nothing verified and unsettled.
                  </TableCell>
                </TableRow>
              ) : (
                ready.map((r) => (
                  <TableRow key={r.partnerId} data-testid={`ready-${r.partnerId}`}>
                    <TableCell className="font-medium">
                      {r.partnerName}
                      {r.contractStatus !== "ACTIVE" && <StatusBadge status={r.contractStatus} className="ml-2" />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(r.total)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatDhakaDate(r.oldest)} – {formatDhakaDate(r.newest)}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <CreateDraftForm partnerId={r.partnerId} defaultFrom={toDhakaDateInput(r.oldest)} defaultTo={toDhakaDateInput(new Date())} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="list-h">
        <h2 id="list-h" className="text-lg font-semibold">
          Settlements
        </h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Redemptions</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created / approved by</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground h-16 text-center">
                    No settlements yet.
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.partner.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatDhakaDate(s.periodStart)} – {formatDhakaDate(periodLastInstant(s.periodEnd))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s._count.redemptions}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatBDT(s.totalAmount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.createdBy.name}
                      <span className="text-muted-foreground"> / {s.approvedBy?.name ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/settlements/${s.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
