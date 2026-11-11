import Link from "next/link";
import { notFound } from "next/navigation";

import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { db } from "@/server/db";

import { BranchForm } from "../branch-form";

export const metadata = { title: "New branch" };

export default async function NewBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage(PERMISSIONS.managePartners, `/admin/partners/${id}/branches/new`);
  const partner = await db.partner.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!partner) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/admin/partners/${partner.id}`} className="text-muted-foreground text-sm hover:underline">
          ← {partner.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New branch</h1>
        <p className="text-muted-foreground text-sm">A 4-digit cashier PIN is generated and shown once after you create the branch.</p>
      </div>
      <BranchForm partnerId={partner.id} partnerName={partner.name} initial={{ name: "", area: "", address: "", smsPhone: "", active: true }} />
    </div>
  );
}
