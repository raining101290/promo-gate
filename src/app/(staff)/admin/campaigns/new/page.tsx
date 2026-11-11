import { toDhakaInput } from "@/lib/time";
import { PERMISSIONS, requireStaffPage } from "@/server/auth/require-role";

import { CampaignForm } from "../campaign-form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  await requireStaffPage(PERMISSIONS.manageCampaigns, "/admin/campaigns/new");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
      <CampaignForm
        initial={{
          name: "",
          offerType: "FIXED",
          value: "",
          maxDiscount: "",
          minBill: "",
          validityDays: "30",
          totalBudget: "",
          perCustomerLimit: "",
          startsAt: toDhakaInput(new Date()),
          endsAt: "",
        }}
      />
    </div>
  );
}
