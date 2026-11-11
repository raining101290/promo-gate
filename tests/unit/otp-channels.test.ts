import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { enabledOtpChannels } from "@/server/otp-channels";
import { sendSms } from "@/server/services/notifications";
import { requestOtp } from "@/server/services/otp";

const saved = { OTP_CHANNELS: process.env.OTP_CHANNELS, SMS_DRIVER: process.env.SMS_DRIVER };
afterEach(() => Object.assign(process.env, saved));
const set = (env: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe("OTP channels", () => {
  it("defaults to email only; SMS must be switched on and needs an SMS driver", () => {
    set({ OTP_CHANNELS: undefined, SMS_DRIVER: "file" });
    expect(enabledOtpChannels()).toEqual(["EMAIL"]);
    set({ OTP_CHANNELS: "email, sms" });
    expect(enabledOtpChannels()).toEqual(["EMAIL", "SMS"]);
    set({ SMS_DRIVER: "off" });
    expect(enabledOtpChannels()).toEqual(["EMAIL"]);
    set({ OTP_CHANNELS: "nonsense" });
    expect(enabledOtpChannels()).toEqual(["EMAIL"]);
  });

  it("the server refuses SMS codes when SMS login is off (no code row, no SMS, no rate-limit hit)", async () => {
    set({ OTP_CHANNELS: "EMAIL", SMS_DRIVER: "file" });
    const phone = "+8801799000001";
    const r = await requestOtp({ channel: "SMS", target: phone }, { ip: "203.0.113.9" });
    expect(r).toEqual({ ok: false, reason: "channel_disabled" });
    expect(await db.otpCode.count({ where: { target: phone } })).toBe(0);
    expect(await db.smsLog.count({ where: { toPhone: phone } })).toBe(0);
    expect(await db.rateLimitHit.count({ where: { key: { contains: phone } } })).toBe(0);
  });

  it("email codes still work", async () => {
    set({ OTP_CHANNELS: "EMAIL" });
    const r = await requestOtp({ channel: "EMAIL", target: "otp-channels@test.local" }, { ip: "203.0.113.10" });
    expect(r.ok).toBe(true);
    expect(await db.otpCode.count({ where: { target: "otp-channels@test.local", channel: "EMAIL" } })).toBe(1);
  });

  it("SMS_DRIVER=off skips SMS without logging or retrying", async () => {
    set({ SMS_DRIVER: "off" });
    const t0 = Date.now();
    expect(await sendSms("+8801799000002", "hi", { purpose: "branch_redemption" })).toBe(false);
    expect(Date.now() - t0).toBeLessThan(200);
    expect(await db.smsLog.count({ where: { toPhone: "+8801799000002" } })).toBe(0);
  });
});
