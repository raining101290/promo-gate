import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getBranchForStaff } from "@/server/services/branches";

import { BranchForm } from "../branch-form";
import { ResetPinButton } from "../reset-pin-button";

export const metadata = { title: "Edit branch" };

export default async function EditBranchPage({ params }: { params: Promise<{ id: string; branchId: string }> }) {
  const { id, branchId } = await params;
  await requireStaffPage(PERMISSIONS.managePartners, `/admin/partners/${id}/branches/${branchId}`);
  const branch = await getBranchForStaff(branchId);
  if (!branch || branch.partnerId !== id) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/admin/partners/${id}`} className="text-muted-foreground text-sm hover:underline">
          ← {branch.partner.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{branch.name}</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/branches/${branch.id}/standee`}>Print standee</Link>
            </Button>
            <ResetPinButton branchId={branch.id} branchName={branch.name} />
          </div>
        </div>
      </div>
      <BranchForm
        partnerId={id}
        partnerName={branch.partner.name}
        branchId={branch.id}
        branchCode={branch.branchCode}
        initial={{ name: branch.name, area: branch.area, address: branch.address, smsPhone: branch.smsPhone, active: branch.active }}
      />
    </div>
  );
}
