import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db";
import { BulkSmsBdDriver, SmsGatewayError } from "@/server/providers/sms";
import { sendSms } from "@/server/services/notifications";

const URL_SEND = "https://bulksmsbd.test/api/smsapi";
const URL_BAL = "https://bulksmsbd.test/api/getBalanceApi";
const driver = () => new BulkSmsBdDriver({ url: URL_SEND, balanceUrl: URL_BAL, apiKey: "k", senderId: "Hosting.com" });

/** Fake gateway: answers each call with the next JSON body and records the form it received. */
function fakeGateway(...bodies: object[]) {
  const calls: { url: string; form: URLSearchParams }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, form: new URLSearchParams(String(init.body)) });
      return new Response(JSON.stringify(bodies[Math.min(calls.length - 1, bodies.length - 1)]), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("BulkSmsBdDriver", () => {
  it("posts the documented fields and accepts 202", async () => {
    const calls = fakeGateway({ response_code: 202, success_message: "SMS Submitted Successfully", error_message: "" });
    await expect(driver().send("+8801712345678", "Your code is 123456")).resolves.toBeDefined();
    expect(calls[0].url).toBe(URL_SEND);
    expect(Object.fromEntries(calls[0].form)).toEqual({
      api_key: "k",
      type: "text",
      number: "8801712345678",
      senderid: "Hosting.com",
      message: "Your code is 123456",
    });
  });

  it("turns gateway codes into non-retryable / retryable errors", async () => {
    fakeGateway({ response_code: 1032, error_message: "Your ip 1.2.3.4 not Whitelisted" });
    const e1 = await driver()
      .send("+8801712345678", "x")
      .catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(SmsGatewayError);
    expect(e1).toMatchObject({ code: "1032", retryable: false, message: "Gateway 1032: Your ip 1.2.3.4 not Whitelisted" });

    fakeGateway({ response_code: 1007, error_message: "" });
    await expect(driver().send("+8801712345678", "x")).rejects.toMatchObject({
      code: "1007",
      retryable: false,
      message: "Gateway 1007: Balance insufficient",
    });

    fakeGateway({ response_code: 1005, error_message: "Internal Error" });
    await expect(driver().send("+8801712345678", "x")).rejects.toMatchObject({ code: "1005", retryable: true });
  });

  it("reads the balance", async () => {
    const calls = fakeGateway({ response_code: 202, balance: 2087.57000000000016 });
    await expect(driver().balance()).resolves.toBe(2087.57);
    expect(calls[0].url).toBe(URL_BAL);
    expect(calls[0].form.get("api_key")).toBe("k");
  });
});

describe("sendSms with the BulkSMSBD driver", () => {
  beforeAll(() => {
    process.env.SMS_DRIVER = "bulksmsbd";
    process.env.SMS_API_URL = URL_SEND;
    process.env.SMS_API_KEY = "k";
    process.env.SMS_SENDER_ID = "Hosting.com";
  });

  const rows = (to: string) => db.smsLog.findMany({ where: { toPhone: to }, orderBy: { attempt: "asc" } });

  it("stops after one attempt on a permanent error (no wasted retries)", async () => {
    const to = "+8801711000001";
    const calls = fakeGateway({ response_code: 1001, error_message: "Invalid Number" });
    expect(await sendSms(to, "hello", { purpose: "otp", logBody: "Login code [redacted]" })).toBe(false);
    expect(calls).toHaveLength(1);
    const log = await rows(to);
    expect(log.map((r) => [r.status, r.attempt, r.provider, r.body])).toEqual([["FAILED", 1, "bulksmsbd", "Login code [redacted]"]]);
    expect(log[0].error).toBe("Gateway 1001: Invalid Number");
  });

  it("retries a temporary error and logs every attempt", async () => {
    const to = "+8801711000002";
    const calls = fakeGateway({ response_code: 1005, error_message: "Internal Error" }, { response_code: 202, success_message: "ok" });
    expect(await sendSms(to, "hello", { purpose: "branch_redemption" })).toBe(true);
    expect(calls).toHaveLength(2);
    expect((await rows(to)).map((r) => [r.status, r.attempt])).toEqual([
      ["FAILED", 1],
      ["SENT", 2],
    ]);
  });
});
