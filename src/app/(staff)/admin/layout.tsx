import type { Metadata } from "next";

import { getStaff } from "@/server/auth/require-role";

import { navFor } from "./nav";
import { SidebarNav } from "./sidebar-nav";

export const metadata: Metadata = { title: { default: "Admin · Hosting.com Perks", template: "%s · Admin · Perks" } };

const ROLE_LABEL = { SUPPORT: "Support", FINANCE: "Finance", ADMIN: "Admin" } as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  // Unauthenticated: middleware only lets /admin/login through, which renders without the shell.
  // Every page still calls requireStaffPage() itself; this layout is not the guard.
  if (!staff) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="bg-muted/30 flex print:hidden shrink-0 flex-col gap-4 border-b p-4 md:w-56 md:border-r md:border-b-0">
        <div className="px-3">
          <p className="font-semibold tracking-tight">
            Perks <span className="text-muted-foreground font-normal">Admin</span>
          </p>
        </div>
        {/* While a temporary password must be replaced, every other page redirects anyway: hide the nav. */}
        <SidebarNav items={staff.mustChangePassword ? [] : navFor(staff.role)} />
        <div className="mt-auto hidden space-y-2 px-3 text-sm md:block">
          <div>
            <p className="truncate font-medium">{staff.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {staff.email} · {ROLE_LABEL[staff.role]}
            </p>
          </div>
          <a href="/admin/account/password" className="text-muted-foreground hover:text-foreground block text-sm underline-offset-4 hover:underline">
            Change password
          </a>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 lg:p-8 print:p-0">{children}</main>
    </div>
  );
}
