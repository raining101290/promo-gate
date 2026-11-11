import { NextResponse } from "next/server";

import { createSettlementSchema } from "@/lib/schemas/settlement";
import { dhakaDayStart } from "@/lib/time";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { createDraftSettlement } from "@/server/services/settlements";

export async function POST(req: Request) {
  return withStaff(PERMISSIONS.manageSettlements, async (staff) => {
    const parsed = createSettlementSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    const { partnerId, from, to } = parsed.data;
    const start = dhakaDayStart(from);
    const lastDay = dhakaDayStart(to);
    if (!start || !lastDay) return NextResponse.json({ ok: false, error: "Invalid dates" }, { status: 400 });
    const end = new Date(lastDay.getTime() + 24 * 60 * 60 * 1000); // exclusive: start of the day after `to`

    const r = await createDraftSettlement(partnerId, start, end, staff.id);
    if (!r.ok) {
      const msg = { partner_not_found: [404, "Partner not found."], nothing_to_settle: [409, "No verified, unsettled redemptions for this partner in that period."], bad_period: [400, "Invalid period."] }[r.reason];
      return NextResponse.json({ ok: false, reason: r.reason, error: msg[1] }, { status: msg[0] as number });
    }
    return NextResponse.json(r, { status: 201 });
  });
}
