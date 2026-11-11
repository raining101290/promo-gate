import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/safe-redirect";
import { otpVerifySchema } from "@/lib/schemas/auth";
import { createSession } from "@/server/auth/session";
import { clientIp } from "@/server/rate-limit";
import { verifyOtp } from "@/server/services/otp";

const MESSAGES = {
  expired: "This code has expired or was already used. Request a new code.",
  locked: "Too many wrong attempts. Request a new code.",
  no_customer: "No offers found for this email/phone yet.",
  rate_limited: "Too many attempts. Please wait 15 minutes and try again.",
} as const;

export async function POST(req: Request) {
  const parsed = otpVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { target, code, next } = parsed.data;

  const result = await verifyOtp(target, code, { ip: clientIp(req.headers) });
  if (result.ok) {
    await createSession({ sub: result.customerId, kind: "customer" });
    return NextResponse.json({ ok: true, redirectTo: safeNextPath(next) });
  }

  if (result.reason === "invalid") {
    const error =
      result.attemptsLeft > 0
        ? `Incorrect code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.`
        : "Incorrect code. No attempts left; request a new code.";
    return NextResponse.json({ ok: false, reason: result.reason, error }, { status: 401 });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason, error: MESSAGES[result.reason] },
    { status: result.reason === "no_customer" ? 404 : result.reason === "rate_limited" ? 429 : 401 },
  );
}
