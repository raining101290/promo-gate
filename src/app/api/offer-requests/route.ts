import { NextResponse } from "next/server";

import { offerRequestInputSchema } from "@/lib/schemas/offer-request";
import { getCustomerSession } from "@/server/auth/customer";
import { clientIp } from "@/server/rate-limit";
import { submitOfferRequest } from "@/server/services/offer-requests";

export async function POST(req: Request) {
  const parsed = offerRequestInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return NextResponse.json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
  }

  const session = await getCustomerSession();
  const result = await submitOfferRequest(parsed.data, {
    ip: clientIp(req.headers),
    currentCustomerId: session?.sub,
  });

  if (!result.ok) {
    const status = result.reason === "rate_limited" ? 429 : 409;
    const headers = result.reason === "rate_limited" ? { "Retry-After": String(result.retryAfterSeconds) } : undefined;
    const fieldErrors = result.reason === "duplicate_invoice" ? { invoiceNumber: result.message } : undefined;
    return NextResponse.json({ ok: false, reason: result.reason, error: result.message, fieldErrors }, { status, headers });
  }

  return NextResponse.json({
    ok: true,
    offerRequestId: result.offerRequestId,
    next: result.otp ? "otp" : "dashboard",
    otp: result.otp,
  });
}
