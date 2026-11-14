import { NextResponse } from "next/server";

import { badId, readId } from "@/app/api/id-param";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { retryUpmindDeliveryNow } from "@/server/services/upmind";

/** Send one pending/failed redemption callback to Upmind now. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.retryUpmind, async (staff) => {
    const id = await readId(params);
    if (!id) return badId();
    const out = await retryUpmindDeliveryNow(id, staff.id);
    if (!out) return NextResponse.json({ ok: false, error: "Already sent, or not found." }, { status: 409 });
    return NextResponse.json({ ok: out.status === "SENT", status: out.status, error: out.error ?? null });
  });
}
