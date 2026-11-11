import { NextResponse } from "next/server";

import { campaignInputSchema } from "@/lib/schemas/campaign";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { createCampaign } from "@/server/services/campaigns";

import { validationError } from "../validation";

export async function POST(req: Request) {
  return withStaff(PERMISSIONS.manageCampaigns, async (staff) => {
    const parsed = campaignInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const campaign = await createCampaign(parsed.data, staff.id);
    return NextResponse.json({ ok: true, id: campaign.id }, { status: 201 });
  });
}
