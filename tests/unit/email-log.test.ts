import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { deleteCustomer, exportCustomerData } from "@/server/services/customer-data";
import { sendEmail } from "@/server/services/notifications";
import { requestOtp } from "@/server/services/otp";

import { customer } from "../support/factories";

/** Fake Resend: answers each call with the next [status, body]. */
function fakeResend(...answers: [number, object][]) {
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const [status, body] = answers[Math.min(n++, answers.length - 1)];
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

// This file runs in its own module context, so the email provider is created fresh with the Resend driver.
beforeAll(() => {
  process.env.EMAIL_DRIVER = "resend";
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Hosting.com Coffee Campaign <perks@perks.example>";
});
afterEach(() => vi.unstubAllGlobals());

const rows = (to: string) => db.emailLog.findMany({ where: { toEmail: to }, orderBy: { createdAt: "asc" } });

describe("sendEmail writes the email log", () => {
  it("logs a SENT row with Resend's id, the subject and type, never the body", async () => {
    fakeResend([200, { id: "re-msg-1" }]);
    const to = "Log-Sent@Test.local";
    expect(await sendEmail(to, "Your voucher expires soon", "secret upload link https://x/abc", { purpose: "expiry_reminder" })).toBe(true);
    const log = await rows("log-sent@test.local");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      status: "SENT",
      provider: "resend",
      providerRef: "re-msg-1",
      subject: "Your voucher expires soon",
      purpose: "expiry_reminder",
      error: null,
    });
    expect(JSON.stringify(log[0])).not.toContain("secret upload link");
  });

  it("logs a FAILED row with the provider's reason and returns false (never throws)", async () => {
    fakeResend([403, { name: "validation_error", message: "You can only send testing emails to your own email address" }]);
    expect(await sendEmail("log-failed@test.local", "Request approved", "body", { purpose: "review" })).toBe(false);
    const [row] = await rows("log-failed@test.local");
    expect(row).toMatchObject({ status: "FAILED", provider: "resend", purpose: "review" });
    expect(row.error).toContain("403");
  });

  it("login codes are logged without the code", async () => {
    fakeResend([200, { id: "re-otp-1" }]);
    const c = await customer();
    expect(await requestOtp({ channel: "EMAIL", target: c.email }, { ip: "203.0.113.77" })).toMatchObject({ ok: true });
    const [row] = await rows(c.email);
    expect(row).toMatchObject({ status: "SENT", purpose: "otp", subject: "Your Hosting.com Coffee Campaign login code" });
    expect(JSON.stringify(row)).not.toMatch(/\b\d{6}\b/);
  });

  it("data export lists the customer's emails; account deletion scrubs them", async () => {
    fakeResend([200, { id: "re-del-1" }]);
    const c = await customer();
    await sendEmail(c.email, "Your request was approved", "body", { purpose: "review" });

    const exported = await exportCustomerData(c.id);
    expect(exported.ok && exported.data.emails).toEqual([expect.objectContaining({ purpose: "review", subject: "Your request was approved" })]);

    expect(await deleteCustomer(c.id)).toMatchObject({ ok: true });
    expect(await rows(c.email)).toHaveLength(0);
  });
});
