import { NextResponse } from "next/server";

import { getCustomerSession } from "@/server/auth/customer";
import { exportCustomerData } from "@/server/services/customer-data";

/** Customer's own data as a JSON download. Session (DB-checked) required; rate limited; audited. */
export async function GET() {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please log in again." }, { status: 401 });
  const result = await exportCustomerData(session.sub);
  if (!result.ok) {
    return result.reason === "rate_limited"
      ? NextResponse.json({ ok: false, error: "Too many exports. Try again later." }, { status: 429 })
      : NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  return new NextResponse(JSON.stringify(result.data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hosting-perks-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
