import { redirect } from "next/navigation";

import { requireStaffPage } from "@/server/auth/require-role";

import { navFor } from "./nav";

/** /admin -> the first section this role may use. */
export default async function AdminIndex() {
  const staff = await requireStaffPage(undefined, "/admin");
  redirect(navFor(staff.role)[0]?.href ?? "/admin/forbidden");
}
