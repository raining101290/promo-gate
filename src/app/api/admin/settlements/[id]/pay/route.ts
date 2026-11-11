import { NextResponse } from "next/server";

import { markPaidSchema } from "@/lib/schemas/settlement";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { markSettlementPaid } from "@/server/services/settlements";

import { settlementResponse } from "../result";
import { badId, readId } from "@/app/api/id-param";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.manageSettlements, async (staff) => {
    const parsed = markPaidSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    const id = await readId(params);
    if (!id) return badId();
    return settlementResponse(await markSettlementPaid(id, parsed.data.paymentRef, staff.id));
  });
}
