import { NextResponse } from "next/server";

import { branchCreateSchema } from "@/lib/schemas/partner";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { createBranch } from "@/server/services/branches";

import { validationError } from "../../../validation";
import { badId, readId } from "@/app/api/id-param";

/** Creates a branch. The response carries the plaintext PIN exactly once; it is never stored or logged. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.managePartners, async (staff) => {
    const parsed = branchCreateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.issues);
    const id = await readId(params);
    if (!id) return badId();
    const result = await createBranch(id, parsed.data, staff.id);
    if (!result.ok) {
      return result.reason === "code_taken"
        ? NextResponse.json(
            { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { branchCode: "That code is already used by another branch" } },
            { status: 409 },
          )
        : NextResponse.json({ ok: false, error: "Partner not found." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, branch: result.branch, pin: result.pin },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  });
}
