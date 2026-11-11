import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { staffLoginSchema } from "@/lib/schemas/staff";
import { PASSWORD_PAGE } from "@/server/auth/require-role";
import { createSession } from "@/server/auth/session";
import { clientIp } from "@/server/rate-limit";
import { authenticateStaff } from "@/server/services/staff-auth";

export async function POST(req: Request) {
  const parsed = staffLoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password, next } = parsed.data;

  const result = await authenticateStaff(email, password, clientIp(req.headers));
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return NextResponse.json(
        { ok: false, error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
    return NextResponse.json({ ok: false, error: "Incorrect email or password." }, { status: 401 });
  }

  await createSession({ sub: result.staff.id, kind: "staff", role: result.staff.role, sv: result.staff.sessionVersion });
  // Temporary (admin-issued) password: go straight to choosing a new one.
  if (result.staff.mustChangePassword) return NextResponse.json({ ok: true, redirectTo: PASSWORD_PAGE });
  const target = safeNextPath(next, "/admin");
  return NextResponse.json({ ok: true, redirectTo: target.startsWith("/admin") ? target : "/admin" });
}
