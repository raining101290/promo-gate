import Link from "next/link";

import { HelpLink } from "@/components/staff/help-link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listPartners } from "@/server/services/partners";

export const metadata = { title: "Partners" };

/** Last 4 characters only in the list; the full account is on the partner page. */
const maskAccount = (s: string) => `•••• ${s.replace(/\s/g, "").slice(-4)}`;

export default async function PartnersPage() {
  const staff = await requireStaffPage(PERMISSIONS.viewPartners, "/admin/partners");
  const canManage = (PERMISSIONS.managePartners as readonly string[]).includes(staff.role);
  const partners = await listPartners();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
            <HelpLink slug="partners-branches" />
          </div>
          <p className="text-muted-foreground text-sm">Coffee shops and their branches. Paused or ended partners can&apos;t accept vouchers.</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/admin/partners/new">New partner</Link>
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Payout</TableHead>
              <TableHead className="text-right">Branches</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No partners yet.
                </TableCell>
              </TableRow>
            ) : (
              partners.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <div>{p.contactName}</div>
                    <div className="text-muted-foreground text-xs">{p.contactPhone}</div>
                  </TableCell>
                  <TableCell>
                    {p.payoutMethod === "BKASH" ? "bKash" : "Bank"}{" "}
                    <span className="text-muted-foreground font-mono text-xs">{maskAccount(p.payoutAccount)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.activeBranchCount} active
                    {p.branchCount > p.activeBranchCount && <span className="text-muted-foreground"> / {p.branchCount}</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.contractStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/partners/${p.id}`}>{canManage ? "Manage" : "View"}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
