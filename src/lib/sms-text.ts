// SMS copy rules: ASCII from the GSM-7 basic set only (no ৳, no Bangla, no curly quotes), so a
// message is one 160-character segment instead of 70-char UCS-2 segments.

export const SMS_MAX = 160;

const UNSAFE = /[^A-Za-z0-9 .,:;'()/&+\-#!?@]/g;

/** "Café Gulshan—2" -> "Cafe Gulshan-2". Non-Latin text disappears (callers provide a fallback). */
export function toSmsAscii(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(UNSAFE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 100000 -> "1000", 125050 -> "1250.50" (no currency sign, no grouping). */
export function plainTaka(paisa: number): string {
  return paisa % 100 === 0 ? String(paisa / 100) : (paisa / 100).toFixed(2);
}

const timeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "10 Nov 16:29" in Dhaka time. */
export function smsTime(d: Date): string {
  const p = Object.fromEntries(timeParts.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

/**
 * Fits `build(name)` into SMS_MAX by shortening only the (variable) name, marking the cut with ".".
 * Returns null if even a 3-character name doesn't fit (callers then drop the name entirely).
 */
function fitName(name: string, build: (n: string) => string, marker = "."): string | null {
  if (build(name).length <= SMS_MAX) return build(name);
  let n = name;
  while (n.length > 3 && build(`${n}${marker}`).length > SMS_MAX) n = n.slice(0, -1);
  n = n.replace(/[\s,.;:-]+$/, "");
  const msg = build(`${n}${marker}`);
  return msg.length <= SMS_MAX ? msg : null;
}

export function branchRedemptionSms(r: {
  branchName: string;
  branchCode: string;
  bill: number;
  discount: number;
  customerPays: number;
  ref: string;
  at: Date;
}): string {
  const name = toSmsAscii(r.branchName) || r.branchCode;
  const tail = `: bill ${plainTaka(r.bill)}, voucher ${plainTaka(r.discount)}, customer pays ${plainTaka(r.customerPays)}. Ref ${r.ref}. ${smsTime(r.at)}`;
  // Amounts, ref and time are what the cashier needs; the name is the part we shorten.
  return fitName(name, (n) => `Hosting.com voucher used at ${n}${tail}`) ?? `Hosting.com voucher used${tail}`.slice(0, SMS_MAX);
}

export function customerReceiptSms(r: { branchName: string; branchCode: string; discount: number; ref: string; uploadUrl: string }): string {
  const name = toSmsAscii(r.branchName) || r.branchCode;
  const tail = `Ref ${r.ref}. Upload receipt photo: ${r.uploadUrl}`;
  // Never cut the link: shorten the name, then drop it; a long URL may exceed one segment rather than break.
  return (
    fitName(name, (n) => `Hosting.com Perks: ${plainTaka(r.discount)} BDT voucher used at ${n}. ${tail}`, "") ??
    `Hosting.com Perks: ${plainTaka(r.discount)} BDT voucher used. ${tail}`
  );
}

const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" });

export function expiryReminderSms(r: { discountLabel: string; expiresAt: Date; dashboardUrl: string }): string {
  // All parts are ASCII already (label from plainTaka/percent, en-GB date, URL); no name to shorten.
  return `Hosting.com Perks: your ${r.discountLabel} coffee voucher expires on ${dayMonth.format(r.expiresAt)}. Use it at any partner cafe: ${r.dashboardUrl}`;
}
