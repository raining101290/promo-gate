import "server-only";

export type OtpChannelName = "EMAIL" | "SMS";

/**
 * Which channels customers may receive login codes on. OTP_CHANNELS="EMAIL" (default) or "EMAIL,SMS".
 * SMS is never offered while SMS_DRIVER=off. Enforced server-side in requestOtp; the forms only mirror it.
 */
export function enabledOtpChannels(): OtpChannelName[] {
  const raw = (process.env.OTP_CHANNELS ?? "EMAIL")
    .toUpperCase()
    .split(",")
    .map((s) => s.trim());
  const smsOff = process.env.SMS_DRIVER === "off";
  const list = (["EMAIL", "SMS"] as const).filter((c) => raw.includes(c) && !(c === "SMS" && smsOff));
  return list.length > 0 ? list : ["EMAIL"];
}

export function otpChannelEnabled(c: OtpChannelName): boolean {
  return enabledOtpChannels().includes(c);
}
