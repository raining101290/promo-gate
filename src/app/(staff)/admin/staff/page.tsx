import { HelpLink } from "@/components/staff/help-link";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDhakaDateTime } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { listStaff } from "@/server/services/staff";

import { AddStaffDialog } from "./add-staff-dialog";
import { StaffRowActions } from "./staff-row-actions";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireStaffPage(PERMISSIONS.manageStaff, "/admin/staff");
  const staff = await listStaff();
  const activeAdmins = staff.filter((s) => s.role === "ADMIN" && s.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
            <HelpLink slug="staff" />
          </div>
          <p className="text-muted-foreground text-sm">
            Who can sign in to the admin. Changes apply on their next click; resetting a password or deactivating also signs them out everywhere.
          </p>
        </div>
        <AddStaffDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in (Dhaka)</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => {
              const isMe = s.id === me.id;
              const lastAdmin = s.role === "ADMIN" && s.active && activeAdmins <= 1;
              return (
                <TableRow key={s.id} className={s.active ? undefined : "opacity-60"} data-testid={`staff-${s.email}`}>
                  <TableCell>
                    <div className="font-medium">
                      {s.name} {isMe && <Badge variant="secondary">you</Badge>}
                    </div>
                    <div className="text-muted-foreground text-xs">{s.email}</div>
                  </TableCell>
                  <TableCell>{s.role.charAt(0) + s.role.slice(1).toLowerCase()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={s.active ? "ACTIVE" : "VOID"} />
                      {s.mustChangePassword && s.active && <Badge variant="outline">Temporary password</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {s.lastLoginAt ? formatDhakaDateTime(s.lastLoginAt) : <span className="text-muted-foreground">never</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <StaffRowActions id={s.id} name={s.name} email={s.email} role={s.role} active={s.active} isSelf={isMe} lastAdmin={lastAdmin} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
