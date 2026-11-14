import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { retryUpmindDeliveries } from "@/server/services/upmind";
import { runVoucherExpiry } from "@/server/services/voucher-expiry";

// Scheduling: see "Cron" in CLAUDE.md (Vercel Cron via vercel.json, or system cron with curl).

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; other schedulers may use `x-cron-secret`. */
function authorised(req: Request): boolean | "unconfigured" {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return "unconfigured";
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  const auth = authorised(req);
  if (auth === "unconfigured") return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  if (!auth) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await runVoucherExpiry();
  // Same hourly job retries Upmind redemption callbacks that failed.
  const upmind = await retryUpmindDeliveries();
  return NextResponse.json({ ok: true, ...result, upmind }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle;
