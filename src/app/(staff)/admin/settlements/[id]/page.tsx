import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBDT } from "@/lib/money";
import { redemptionRef } from "@/lib/redemption";
import { formatDhakaDate, formatDhakaDateTime } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getSettlement, periodLastInstant } from "@/server/services/settlements";

import { SettlementActions } from "./settlement-actions";

export const metadata = { title: "Settlement" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function SettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(PERMISSIONS.viewSettlements, `/admin/settlements/${id}`);
  const s = await getSettlement(id);
  if (!s) notFound();
  const canManage = (PERMISSIONS.manageSettlements as readonly string[]).includes(staff.role);
  const billTotal = s.redemptions.reduce((n, r) => n + r.billAmount, 0);
  const voucherTotal = s.redemptions.reduce((n, r) => n + r.discountAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settlements" className="text-muted-foreground text-sm hover:underline">
          ← Settlements
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{s.partner.name}</h1>
          <StatusBadge status={s.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDhakaDate(s.periodStart)} – {formatDhakaDate(periodLastInstant(s.periodEnd))} · {s.redemptions.length} redemptions
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Total to pay">
                <span className="text-xl font-semibold tabular-nums" data-testid="settlement-total">
                  {formatBDT(s.totalAmount)}
                </span>
                {s.totalAmount !== voucherTotal && <span className="text-destructive ml-2 text-xs">does not match lines ({formatBDT(voucherTotal)})</span>}
              </Row>
              <Row label="Pay to">
                {s.partner.payoutMethod === "BKASH" ? "bKash" : "Bank"} · <span className="font-mono">{s.partner.payoutAccount}</span>
              </Row>
              <Row label="Partner contact">
                {s.partner.contactName}, {s.partner.contactPhone}
              </Row>
              <Row label="Created">
                {s.createdBy.name}, {formatDhakaDateTime(s.createdAt)}
              </Row>
              <Row label="Approved">{s.approvedBy ? `${s.approvedBy.name}, ${formatDhakaDateTime(s.approvedAt!)}` : "—"}</Row>
              <Row label="Paid">{s.paidAt ? `${s.paidBy?.name ?? "—"}, ${formatDhakaDateTime(s.paidAt)}` : "—"}</Row>
              <Row label="Payment ref">{s.paymentRef ? <span className="font-mono">{s.paymentRef}</span> : "—"}</Row>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {canManage && (
            <SettlementActions
              settlementId={s.id}
              status={s.status}
              isCreator={s.createdBy.id === staff.id}
              creatorName={s.createdBy.name}
              total={formatBDT(s.totalAmount)}
            />
          )}
          <Button asChild variant="outline" className="w-full">
            <a href={`/api/admin/settlements/${s.id}/statement`} data-testid="csv">
              Download CSV statement
            </a>
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Redemptions in this settlement</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Date (Dhaka)</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Bill</TableHead>
                <TableHead className="text-right">Voucher</TableHead>
                <TableHead>POS receipt no.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.redemptions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">
                    <Link href={`/admin/redemptions/${r.id}`} className="hover:underline">
                      {redemptionRef(r.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDhakaDateTime(r.redeemedAt)}</TableCell>
                  <TableCell>{r.branch.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBDT(r.billAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBDT(r.discountAmount)}</TableCell>
                  <TableCell className="font-mono">{r.posReceiptNo ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatBDT(billTotal)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatBDT(voucherTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>
    </div>
  );
}
