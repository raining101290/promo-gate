import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDhakaDate } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getPartnerWithBranches } from "@/server/services/partners";

import { PartnerForm } from "../partner-form";
import { ResetPinButton } from "./branches/reset-pin-button";

export const metadata = { title: "Partner" };

export default async function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(PERMISSIONS.viewPartners, `/admin/partners/${id}`);
  const canManage = (PERMISSIONS.managePartners as readonly string[]).includes(staff.role);
  const partner = await getPartnerWithBranches(id);
  if (!partner) notFound();
  const redeemable = partner.contractStatus === "ACTIVE";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partners" className="text-muted-foreground text-sm hover:underline">
          ← Partners
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{partner.name}</h1>
          <StatusBadge status={partner.contractStatus} />
        </div>
        {!redeemable && (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Contract is {partner.contractStatus.toLowerCase()}: none of this partner&apos;s branches can accept vouchers.
          </p>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[28rem_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{canManage ? "Partner details" : "Details"}</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <PartnerForm
                partnerId={partner.id}
                initial={{
                  name: partner.name,
                  contactName: partner.contactName,
                  contactPhone: partner.contactPhone,
                  payoutMethod: partner.payoutMethod,
                  payoutAccount: partner.payoutAccount,
                  contractStatus: partner.contractStatus,
                }}
              />
            ) : (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Contact</dt>
                <dd>
                  {partner.contactName}, {partner.contactPhone}
                </dd>
                <dt className="text-muted-foreground">Payout</dt>
                <dd>
                  {partner.payoutMethod === "BKASH" ? "bKash" : "Bank"}: <span className="font-mono">{partner.payoutAccount}</span>
                </dd>
                <dt className="text-muted-foreground">Partner since</dt>
                <dd>{formatDhakaDate(partner.createdAt)}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Branches</h2>
            {canManage && (
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href={`/admin/partners/${partner.id}/cashier-guide`}>Print cashier guide</Link>
                </Button>
                <Button asChild>
                  <Link href={`/admin/partners/${partner.id}/branches/new`}>Add branch</Link>
                </Button>
              </div>
            )}
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Code / QR link</TableHead>
                  <TableHead>SMS phone</TableHead>
                  <TableHead className="text-right">Redemptions</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && (
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {partner.branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="text-muted-foreground h-20 text-center">
                      No branches yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  partner.branches.map((b) => (
                    <TableRow key={b.id} className={b.active ? undefined : "opacity-60"}>
                      <TableCell>
                        <div className="font-medium">{b.name}</div>
                        <div className="text-muted-foreground max-w-56 truncate text-xs">
                          {b.area} · {b.address}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">/r/{b.branchCode}</TableCell>
                      <TableCell className="text-sm">{b.smsPhone}</TableCell>
                      <TableCell className="text-right tabular-nums">{b._count.redemptions}</TableCell>
                      <TableCell>
                        <Badge variant={b.active && redeemable ? "default" : "secondary"}>
                          {!b.active ? "Inactive" : redeemable ? "Accepting" : "Blocked by contract"}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/partners/${partner.id}/branches/${b.id}`}>Edit</Link>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/branches/${b.id}/standee`}>Standee</Link>
                            </Button>
                            <ResetPinButton branchId={b.id} branchName={b.name} />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
