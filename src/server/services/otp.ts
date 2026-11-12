import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { maskEmail, maskPhone } from "@/lib/phone";
import type { LoginTarget } from "@/lib/schemas/auth";
import { db } from "@/server/db";
import { sessionSecret } from "@/server/env";
import { otpChannelEnabled } from "@/server/otp-channels";
import { sendEmail, sendSms } from "@/server/services/notifications";
import { limit } from "@/server/rate-limit";
import { writeAudit } from "@/server/services/audit";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Shown for every accepted request, whether or not a customer exists for the target. */
export const OTP_SENT_MESSAGE = "If this email or phone can receive codes, we've sent a 6-digit code. It expires in 5 minutes.";

function hashCode(target: string, code: string): string {
  return createHmac("sha256", sessionSecret()).update(`${target}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function mask({ channel, target }: LoginTarget): string {
  return channel === "EMAIL" ? maskEmail(target) : maskPhone(target);
}

export type RequestOtpResult = { ok: true; message: string } | { ok: false; reason: "rate_limited" | "channel_disabled" };

export async function requestOtp(login: LoginTarget, ctx: { ip: string }): Promise<RequestOtpResult> {
  const { channel, target } = login;
  // Checked before rate limits so a disabled channel never costs the customer an attempt.
  if (!otpChannelEnabled(channel)) return { ok: false, reason: "channel_disabled" };
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = new Date();

  // Per-IP first (SMS pumping across many numbers), then per-target.
  if (!(await limit("otpRequestIp", ctx.ip)).allowed) return { ok: false, reason: "rate_limited" };
  if (!(await limit("otpRequestTarget", target)).allowed) return { ok: false, reason: "rate_limited" };

  const created = await db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { deletedAt: null, ...(channel === "EMAIL" ? { email: target } : { phone: target }) },
      select: { id: true },
    });
    await tx.otpCode.create({
      data: {
        target,
        channel,
        customerId: customer?.id ?? null,
        codeHash: hashCode(target, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    });
    return true;
  });

  if (!created) return { ok: false, reason: "rate_limited" };

  // Side effect after commit. A delivery failure still returns the generic message (no enumeration).
  const body = `Your Hosting.com Perks login code is ${code}. It expires in 5 minutes. Do not share it.`;
  try {
    if (channel === "EMAIL") {
      // Logged like every email; the code is only in the body, which is never stored.
      await sendEmail(target, "Your Hosting.com Perks login code", body, { purpose: "otp" });
    } else {
      // Retried + logged like every SMS, but the stored body is redacted: codes never reach the DB.
      await sendSms(target, body, { purpose: "otp", logBody: "Login code [redacted]" });
    }
  } catch (err) {
    console.error(`[otp] delivery failed channel=${channel} to=${mask(login)}: ${err instanceof Error ? err.message : "unknown"}`);
  }

  return { ok: true, message: OTP_SENT_MESSAGE };
}

export type VerifyOtpResult =
  | { ok: true; customerId: string }
  | { ok: false; reason: "invalid"; attemptsLeft: number }
  | { ok: false; reason: "expired" | "locked" | "no_customer" | "rate_limited" };

export async function verifyOtp(login: LoginTarget, code: string, ctx: { ip: string }): Promise<VerifyOtpResult> {
  const throttled = !(await limit("otpVerifyIp", ctx.ip)).allowed || !(await limit("otpVerifyTarget", login.target)).allowed;
  const result: VerifyOtpResult = throttled ? { ok: false, reason: "rate_limited" } : await checkCode(login, code);

  await writeAudit({
    actorType: "CUSTOMER",
    actorId: result.ok ? result.customerId : "anonymous",
    action: result.ok ? "auth.login.success" : "auth.login.failure",
    entityType: "Customer",
    entityId: result.ok ? result.customerId : "unknown",
    meta: {
      channel: login.channel,
      target: mask(login),
      ...(result.ok ? {} : { reason: result.reason }),
    },
  });

  return result;
}

async function checkCode({ channel, target }: LoginTarget, code: string): Promise<VerifyOtpResult> {
  const now = new Date();
  // Only the most recent code for a target is valid; requesting a new one supersedes older codes.
  const otp = await db.otpCode.findFirst({ where: { target }, orderBy: { createdAt: "desc" } });
  if (!otp || otp.consumedAt || otp.expiresAt <= now) return { ok: false, reason: "expired" };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const counted = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) return { ok: false, reason: "locked" };

  if (!sameHash(otp.codeHash, hashCode(target, code))) {
    return { ok: false, reason: "invalid", attemptsLeft: OTP_MAX_ATTEMPTS - (otp.attempts + 1) };
  }

  // Single use: only one request can flip consumedAt from null.
  const consumed = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) return { ok: false, reason: "expired" };

  const customer = await db.customer.findFirst({
    where: { deletedAt: null, ...(channel === "EMAIL" ? { email: target } : { phone: target }) },
    select: { id: true },
  });
  if (!customer) return { ok: false, reason: "no_customer" };

  return { ok: true, customerId: customer.id };
}
