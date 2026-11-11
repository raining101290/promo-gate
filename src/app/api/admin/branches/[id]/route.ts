import { NextResponse } from "next/server";

import { branchActiveSchema, branchUpdateSchema } from "@/lib/schemas/partner";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { setBranchActive, updateBranch } from "@/server/services/branches";

import { validationError } from "../../validation";
import { badId, readId } from "@/app/api/id-param";

/** Edit name/area/address/smsPhone/active. branchCode is immutable and not accepted here. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const parsed = branchUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await readId(params);
    if (!id) return badId();
    const branch = await updateBranch(id, parsed.data, staff.id);
    if (!branch) return NextResponse.json({ ok: false, error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  });
}

/** Activate / deactivate: { active: boolean } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const parsed = branchActiveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Expected { active: boolean }" }, { status: 400 });
    const id = await readId(params);
    if (!id) return badId();
    const result = await setBranchActive(id, parsed.data.active, staff.id);
    if (!result) return NextResponse.json({ ok: false, error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ ok: true, ...result });
  });
}
