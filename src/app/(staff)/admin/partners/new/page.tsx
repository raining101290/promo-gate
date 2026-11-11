import Link from "next/link";

import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";

import { PartnerForm } from "../partner-form";

export const metadata = { title: "New partner" };

export default async function NewPartnerPage() {
  await requireStaffPage(PERMISSIONS.managePartners, "/admin/partners/new");
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/admin/partners" className="text-muted-foreground text-sm hover:underline">
          ← Partners
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New partner</h1>
      </div>
      <PartnerForm
        initial={{ name: "", contactName: "", contactPhone: "", payoutMethod: "BANK", payoutAccount: "", contractStatus: "ACTIVE" }}
      />
    </div>
  );
}
