import { NextResponse } from "next/server";

import { partnerInputSchema } from "@/lib/schemas/partner";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { createPartner } from "@/server/services/partners";

import { validationError } from "../validation";

export async function POST(req: Request) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const parsed = partnerInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const partner = await createPartner(parsed.data, staff.id);
    return NextResponse.json({ ok: true, id: partner.id }, { status: 201 });
  });
}
