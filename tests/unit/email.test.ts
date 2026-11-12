import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailSendError, ResendEmailDriver } from "@/server/providers/email";

const driver = () =>
  new ResendEmailDriver({ apiKey: "re_test", from: "Hosting.com Coffee Campaign <perks@perks.example>", replyTo: "support@example.com", retryDelayMs: 1 });

/** Fake Resend API: answers each call with the next [status, body] and records the request. */
function fakeResend(...answers: [number, object][]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
      const [status, body] = answers[Math.min(calls.length - 1, answers.length - 1)];
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("ResendEmailDriver", () => {
  it("sends the documented request and returns the Resend id", async () => {
    const calls = fakeResend([200, { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }]);
    await expect(driver().send("a@b.co", "Your code is 123456", { subject: "Login code" })).resolves.toEqual({
      providerRef: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
    });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].headers.Authorization).toBe("Bearer re_test");
    expect(calls[0].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[0].body).toEqual({
      from: "Hosting.com Coffee Campaign <perks@perks.example>",
      to: ["a@b.co"],
      subject: "Login code",
      text: "Your code is 123456",
      reply_to: "support@example.com",
    });
  });

  it("does not retry permanent errors (unverified domain, bad key)", async () => {
    const calls = fakeResend([403, { statusCode: 403, name: "validation_error", message: "The perks.example domain is not verified." }]);
    const err = await driver()
      .send("a@b.co", "x")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EmailSendError);
    expect(err).toMatchObject({ status: 403, retryable: false, message: "Resend 403 validation_error: The perks.example domain is not verified." });
    expect(calls).toHaveLength(1);
  });

  it("retries once on rate limit / server error with the same idempotency key", async () => {
    const calls = fakeResend([429, { name: "rate_limit_exceeded", message: "Too many requests" }], [200, { id: "ok-id" }]);
    await expect(driver().send("a@b.co", "x")).resolves.toEqual({ providerRef: "ok-id" });
    expect(calls).toHaveLength(2);
    expect(calls[1].headers["Idempotency-Key"]).toBe(calls[0].headers["Idempotency-Key"]);
  });

  it("gives up after the one retry", async () => {
    const calls = fakeResend([500, { name: "internal_server_error", message: "boom" }]);
    await expect(driver().send("a@b.co", "x")).rejects.toMatchObject({ status: 500, retryable: true });
    expect(calls).toHaveLength(2);
  });
});
