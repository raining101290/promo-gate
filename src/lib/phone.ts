// Bangladesh mobile numbers: 01[3-9]XXXXXXXX (11 digits) or +8801[3-9]XXXXXXXX.
const LOCAL = /^01[3-9]\d{8}$/;
const E164 = /^\+8801[3-9]\d{8}$/;

/** Returns the E.164 form (+8801XXXXXXXXX) or null if the input is not a BD mobile number. */
export function normalizeBdPhone(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "");
  if (LOCAL.test(compact)) return `+88${compact}`;
  if (E164.test(compact)) return compact;
  return null;
}

/** +8801712345678 -> +880171****678. For logs and audit meta; never log full numbers. */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 7)}****${e164.slice(-3)}`;
}

/** jane.doe@example.com -> j***@example.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
