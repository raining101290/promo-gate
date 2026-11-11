import { NextResponse } from "next/server";

import type { SettlementActionResult } from "@/server/services/settlements";

export function settlementResponse(r: SettlementActionResult) {
  if (r.ok) return NextResponse.json({ ok: true });
  if (r.reason === "not_found") return NextResponse.json({ ok: false, reason: r.reason, error: "Settlement not found." }, { status: 404 });
  if (r.reason === "same_user") {
    return NextResponse.json({ ok: false, reason: r.reason, error: "You created this draft. A different staff member must approve it." }, { status: 403 });
  }
  const status = r.reason === "wrong_status" ? r.status.toLowerCase() : "in another state";
  return NextResponse.json({ ok: false, reason: r.reason, error: `This settlement is ${status}; that action isn't allowed now.` }, { status: 409 });
}
