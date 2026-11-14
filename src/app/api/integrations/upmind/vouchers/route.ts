import { NextResponse } from "next/server";

import { upmindPushRawSchema, upmindPushSchema } from "@/lib/schemas/upmind";
import { clientIp, limit } from "@/server/rate-limit";
import { checkValidatedCode, dashboardUrl, issueUpmindVoucher, logUpmindInbound, upmindSecret } from "@/server/services/upmind";

/**
 * Upmind -> us: an invoice was paid; issue the customer's voucher.
 * Auth: `validatedCode` = hex HMAC-SHA256(UPMIND_SECRET, `${invoiceNumber}:${email}`). Spec: docs/UPMIND-INTEGRATION.md.
 */
export async function POST(req: Request) {
  const secret = upmindSecret();
  if (!secret) return reply(503, { status: "error", error: "not_configured", message: "The Upmind integration is not configured." });

  const ip = clientIp(req.headers);
  const raw = upmindPushRawSchema.safeParse(await req.json().catch(() => null));
  if (!raw.success) {
    await logUpmindInbound({ outcome: "invalid", httpStatus: 400, detail: "missing or malformed fields" });
    return reply(400, {
      status: "error",
      error: "invalid_request",
      message: "Send JSON with customerName, email, phone, invoiceNumber and validatedCode.",
      fields: [...new Set(raw.error.issues.map((i) => String(i.path[0])))],
    });
  }
  const body = raw.data;

  if (!checkValidatedCode(secret, body.invoiceNumber, body.email, body.validatedCode)) {
    const rl = await limit("upmindAuthFailure", ip);
    await logUpmindInbound({ invoiceNumber: body.invoiceNumber, outcome: "unauthorized", httpStatus: rl.allowed ? 401 : 429 });
    if (!rl.allowed) return reply(429, { status: "error", error: "rate_limited", message: "Too many invalid codes. Try again later." }, rl.retryAfterSeconds);
    return reply(401, { status: "error", error: "invalid_code", message: "validatedCode doesn't match this invoiceNumber and email." });
  }

  const parsed = upmindPushSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    await logUpmindInbound({ invoiceNumber: body.invoiceNumber, outcome: "invalid", httpStatus: 422, detail: `invalid: ${fields.join(", ")}` });
    return reply(422, {
      status: "error",
      error: "invalid_fields",
      message: parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; "),
      fields,
    });
  }
  const input = { ...parsed.data, validatedCode: body.validatedCode };

  const result = await issueUpmindVoucher(input);
  const invoiceNumber = input.invoiceNumber;
  switch (result.kind) {
    case "issued":
    case "already_issued": {
      const httpStatus = result.kind === "issued" ? 201 : 200;
      await logUpmindInbound({ invoiceNumber, outcome: result.kind, httpStatus, offerRequestId: result.offerRequestId });
      return reply(httpStatus, {
        status: result.kind,
        invoiceNumber,
        voucher: { offer: result.voucher.offer, expiresAt: result.voucher.expiresAt.toISOString() },
        loginUrl: dashboardUrl(),
      });
    }
    case "pending_review":
      await logUpmindInbound({ invoiceNumber, outcome: "pending_review", httpStatus: 202, detail: result.reason, offerRequestId: result.offerRequestId });
      return reply(202, {
        status: "pending_review",
        invoiceNumber,
        reason: result.reason,
        message: "Received. Our team will review it; don't send the voucher email yet.",
      });
    case "rejected":
      await logUpmindInbound({ invoiceNumber, outcome: "rejected", httpStatus: 200, offerRequestId: result.offerRequestId });
      return reply(200, { status: "rejected", invoiceNumber, message: "This invoice was reviewed and not approved." });
    case "conflict":
      await logUpmindInbound({ invoiceNumber, outcome: "conflict", httpStatus: 409, detail: result.reason });
      return reply(409, {
        status: "error",
        error: "invoice_used",
        message: "This invoice number already has a voucher request with a different email.",
      });
  }
}

function reply(status: number, body: Record<string, unknown>, retryAfterSeconds?: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}) },
  });
}
