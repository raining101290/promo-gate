// BulkSMSBD check from the command line, using SMS_API_KEY / SMS_SENDER_ID / SMS_API_URL from .env
// (independent of SMS_DRIVER, so the dev server can keep printing codes to the console).
//   npm run sms:test                      -> show gateway credit only (sends nothing, costs nothing)
//   npm run sms:test -- 01XXXXXXXXX       -> also send one test SMS to that number
import "dotenv/config";

import { maskPhone, normalizeBdPhone } from "../src/lib/phone";
import { BULKSMSBD_CODES, BulkSmsBdDriver, SmsGatewayError } from "../src/server/providers/sms";

const apiKey = process.env.SMS_API_KEY;
const senderId = process.env.SMS_SENDER_ID;
const url = process.env.SMS_API_URL || "https://bulksmsbd.net/api/smsapi";
if (!apiKey || !senderId) {
  console.error("Set SMS_API_KEY and SMS_SENDER_ID in .env first.");
  process.exit(1);
}
const driver = new BulkSmsBdDriver({ url, balanceUrl: process.env.SMS_BALANCE_URL || url.replace(/smsapi\/?$/, "getBalanceApi"), apiKey, senderId });

const explain = (err: unknown) => {
  if (err instanceof SmsGatewayError) {
    const hint = err.code === "1032" ? "\n  -> Whitelist this machine's/server's public IP in the BulkSMSBD panel, then retry." : "";
    return `${err.message}${BULKSMSBD_CODES[err.code] ? ` [${err.retryable ? "temporary" : "permanent"}]` : ""}${hint}`;
  }
  return err instanceof Error ? err.message : String(err);
};

try {
  console.log(`Credit: ৳${(await driver.balance()).toFixed(2)}  (sender ID "${senderId}", ${url})`);
} catch (err) {
  console.error(`Balance check failed: ${explain(err)}`);
  process.exit(1);
}

const raw = process.argv[2];
if (raw) {
  const to = normalizeBdPhone(raw);
  if (!to) {
    console.error(`"${raw}" is not a valid BD mobile number (01XXXXXXXXX).`);
    process.exit(1);
  }
  try {
    const { providerRef } = await driver.send(to, "Hosting.com Coffee Campaign: test message. If you received this, SMS delivery works.");
    console.log(`Sent to ${maskPhone(to)}${providerRef ? ` (ref ${providerRef})` : ""}. Check the phone.`);
  } catch (err) {
    console.error(`Send failed: ${explain(err)}`);
    process.exit(1);
  }
}
