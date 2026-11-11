import { NextResponse } from "next/server";

import { db } from "@/server/db";

/**
 * Liveness + DB check for uptime monitors / load balancers. Public by design: reveals only "ok"/"error"
 * and latency, never connection details or error text.
 */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return NextResponse.json({ ok: true, db: "ok", dbLatencyMs: Date.now() - started, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, db: "error", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
