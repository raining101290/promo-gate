import { NextResponse } from "next/server";

import { otpRequestSchema } from "@/lib/schemas/auth";
import { clientIp } from "@/server/rate-limit";
import { requestOtp } from "@/server/services/otp";

export async function POST(req: Request) {
  const parsed = otpRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await requestOtp(parsed.data.target, { ip: clientIp(req.headers) });
  if (!result.ok && result.reason === "channel_disabled") {
    return NextResponse.json(
      { ok: false, error: "Login codes are sent by email. Enter the email address from your hosting.com order." },
      { status: 400 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Too many codes requested. Please wait 15 minutes and try again." }, { status: 429 });
  }
  return NextResponse.json({ ok: true, message: result.message, channel: parsed.data.target.channel });
}
