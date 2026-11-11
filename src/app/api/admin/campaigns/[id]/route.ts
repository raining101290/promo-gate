import { NextResponse } from "next/server";

import { campaignActiveSchema, campaignInputSchema } from "@/lib/schemas/campaign";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { setCampaignActive, updateCampaign } from "@/server/services/campaigns";

import { validationError } from "../../validation";
import { badId, readId } from "@/app/api/id-param";

/** Full edit. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageCampaigns, async (staff) => {
    const parsed = campaignInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await readId(params);
    if (!id) return badId();
    const campaign = await updateCampaign(id, parsed.data, staff.id);
    if (!campaign) return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  });
}

/** Activate / deactivate: { active: boolean } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageCampaigns, async (staff) => {
    const parsed = campaignActiveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Expected { active: boolean }" }, { status: 400 });
    const id = await readId(params);
    if (!id) return badId();
    const result = await setCampaignActive(id, parsed.data.active, staff.id);
    if (!result) return NextResponse.json({ ok: false, error: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  });
}
