import type { StaffRole } from "@/generated/prisma/client";
import { ALL_STAFF, PERMISSIONS } from "@/server/auth/require-role";

export type NavItem = { href: string; label: string };

const NAV: (NavItem & { roles: readonly StaffRole[] })[] = [
  { href: "/admin/requests", label: "Requests", roles: PERMISSIONS.reviewRequests },
  { href: "/admin/redemptions", label: "Redemptions", roles: PERMISSIONS.viewRedemptions },
  { href: "/admin/partners", label: "Partners", roles: PERMISSIONS.viewPartners },
  { href: "/admin/campaigns", label: "Campaigns", roles: PERMISSIONS.manageCampaigns },
  { href: "/admin/settlements", label: "Settlements", roles: PERMISSIONS.viewSettlements },
  { href: "/admin/emails", label: "Email", roles: PERMISSIONS.viewEmail },
  { href: "/admin/sms", label: "SMS", roles: PERMISSIONS.viewSms },
  { href: "/admin/staff", label: "Staff", roles: PERMISSIONS.manageStaff },
  { href: "/admin/audit", label: "Audit log", roles: PERMISSIONS.viewAudit },
  { href: "/admin/help", label: "Help", roles: ALL_STAFF },
];

export function navFor(role: StaffRole): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role)).map(({ href, label }) => ({ href, label }));
}
