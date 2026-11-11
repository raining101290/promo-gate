import { NextResponse } from "next/server";

import { partnerInputSchema } from "@/lib/schemas/partner";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { updatePartner } from "@/server/services/partners";

import { validationError } from "../../validation";
import { badId, readId } from "@/app/api/id-param";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const parsed = partnerInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await readId(params);
    if (!id) return badId();
    const partner = await updatePartner(id, parsed.data, staff.id);
    if (!partner) return NextResponse.json({ ok: false, error: "Partner not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  });
}
