import { NextResponse } from "next/server";

import { csvMoney, toCsv } from "@/lib/csv";
import { redemptionRef } from "@/lib/redemption";
import { slugify } from "@/lib/slug";
import { toDhakaDateInput } from "@/lib/time";
import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { getSettlement, periodLastInstant } from "@/server/services/settlements";
import { badId, readId } from "@/app/api/id-param";

const stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** CSV statement: one row per redemption + a totals row. Dates in Dhaka time. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.viewSettlements, async () => {
    const id = await readId(params);
    if (!id) return badId();
    const s = await getSettlement(id);
    if (!s) return NextResponse.json({ ok: false, error: "Settlement not found." }, { status: 404 });

    const rows = s.redemptions.map((r) => [
      redemptionRef(r.id),
      stamp.format(r.redeemedAt),
      r.branch.name,
      csvMoney(r.billAmount),
      csvMoney(r.discountAmount),
      r.posReceiptNo ?? "",
    ]);
    const billTotal = s.redemptions.reduce((n, r) => n + r.billAmount, 0);
    const voucherTotal = s.redemptions.reduce((n, r) => n + r.discountAmount, 0);
    const csv = toCsv([
      ["Redemption ref", "Date (Dhaka)", "Branch", "Bill (BDT)", "Voucher amount (BDT)", "POS receipt no."],
      ...rows,
      [`TOTAL (${rows.length} redemptions)`, "", "", csvMoney(billTotal), csvMoney(voucherTotal), ""],
    ]);

    const name = `settlement-${slugify(s.partner.name, 24) || "partner"}-${toDhakaDateInput(s.periodStart)}_${toDhakaDateInput(periodLastInstant(s.periodEnd))}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
