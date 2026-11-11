import "server-only";

import { maskEmail, maskPhone } from "@/lib/phone";
import { db } from "@/server/db";
import { getEmailProvider } from "@/server/providers/email";
import { getSmsProvider } from "@/server/providers/sms";

export type SmsPurpose = "otp" | "branch_redemption" | "customer_receipt" | "review" | "expiry_reminder";

/** Backoff before retry 1 and retry 2 (so 3 attempts in total). */
export const SMS_RETRY_DELAYS_MS = [500, 2000] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends one SMS with retries, writing an SmsLog row for EVERY attempt (SENT or FAILED + error).
 * Never throws; returns whether it was delivered to the provider. Call only after the state change
 * that caused it has committed.
 * `logBody` replaces the stored text when the message is secret (OTP codes never reach the DB).
 * Caveat: a timeout after the gateway accepted the message can cause a duplicate on retry.
 */
export async function sendSms(
  to: string,
  body: string,
  opts: { purpose: SmsPurpose; redemptionId?: string; logBody?: string },
): Promise<boolean> {
  const attempts = SMS_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let provider = "unconfigured";
    try {
      const sms = getSmsProvider();
      provider = sms.name;
      const { providerRef } = await sms.send(to, body);
      await log({ to, opts, body, provider, providerRef, status: "SENT", attempt });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sms] ${opts.purpose} attempt ${attempt}/${attempts} to=${maskPhone(to)} failed: ${message}`);
      await log({ to, opts, body, provider, status: "FAILED", attempt, error: message.slice(0, 300) });
      if (attempt < attempts) await sleep(SMS_RETRY_DELAYS_MS[attempt - 1]);
    }
  }
  return false;
}

async function log(e: {
  to: string;
  opts: { purpose: SmsPurpose; redemptionId?: string; logBody?: string };
  body: string;
  provider: string;
  providerRef?: string;
  status: "SENT" | "FAILED";
  attempt: number;
  error?: string;
}) {
  try {
    await db.smsLog.create({
      data: {
        toPhone: e.to,
        body: e.opts.logBody ?? e.body,
        provider: e.provider,
        providerRef: e.providerRef,
        status: e.status,
        attempt: e.attempt,
        error: e.error,
        purpose: e.opts.purpose,
        redemptionId: e.opts.redemptionId,
      },
    });
  } catch (err) {
    console.error(`[sms] could not write SmsLog: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  try {
    await getEmailProvider().send(to, body, { subject });
    return true;
  } catch (err) {
    console.error(`[email] failed to=${maskEmail(to)}: ${err instanceof Error ? err.message : "unknown"}`);
    return false;
  }
}

export type CustomerMessage = {
  sms: string;
  emailSubject: string;
  email: string;
  purpose: SmsPurpose;
  redemptionId?: string;
};

/** One message to a customer's own phone (SMS, retried + logged) and email. Never throws. */
export async function notifyCustomer(customerId: string, msg: CustomerMessage): Promise<void> {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { email: true, phone: true } });
  if (!customer) return;
  await sendSms(customer.phone, msg.sms, { purpose: msg.purpose, redemptionId: msg.redemptionId });
  await sendEmail(customer.email, msg.emailSubject, msg.email);
}
