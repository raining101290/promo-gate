import { notFound } from "next/navigation";

import { paisaToInput } from "@/lib/money";
import { toDhakaInput } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";
import { getCampaign } from "@/server/services/campaigns";

import { CampaignForm } from "../../campaign-form";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage(PERMISSIONS.manageCampaigns, `/admin/campaigns/${id}/edit`);
  const c = await getCampaign(id);
  if (!c) notFound();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit campaign</h1>
        <p className="text-muted-foreground text-sm">Changes apply to vouchers issued from now on. Existing vouchers keep their terms.</p>
      </div>
      <CampaignForm
        campaignId={c.id}
        initial={{
          name: c.name,
          offerType: c.offerType,
          value: c.offerType === "FIXED" ? paisaToInput(c.value) : String(c.value / 100),
          maxDiscount: paisaToInput(c.maxDiscount),
          minBill: paisaToInput(c.minBill),
          validityDays: String(c.validityDays),
          totalBudget: paisaToInput(c.totalBudget),
          perCustomerLimit: c.perCustomerLimit == null ? "" : String(c.perCustomerLimit),
          startsAt: toDhakaInput(c.startsAt),
          endsAt: toDhakaInput(c.endsAt),
        }}
      />
    </div>
  );
}
