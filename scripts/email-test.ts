// Resend check from the command line, using RESEND_API_KEY / EMAIL_FROM / EMAIL_REPLY_TO from .env
// (independent of EMAIL_DRIVER, so the dev server can keep printing codes to the console).
//   npm run email:test -- you@example.com
import "dotenv/config";

import { EmailSendError, ResendEmailDriver } from "../src/server/providers/email";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.argv[2]?.trim();
if (!apiKey || !from) {
  console.error("Set RESEND_API_KEY and EMAIL_FROM in .env first.");
  process.exit(1);
}
if (!to || !to.includes("@")) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}

const hint = (err: EmailSendError) => {
  if (err.status === 401 || (err.status === 400 && /api key/i.test(err.message)))
    return "\n  -> The API key is wrong or was deleted. Create a new one in Resend → API Keys.";
  if (err.status === 403)
    return `\n  -> EMAIL_FROM (${from}) must use a domain verified in Resend → Domains. Until then Resend only delivers to your own Resend login address.`;
  if (err.status === 422 && /`to`/.test(err.message))
    return "\n  -> Resend blocks example.com-style addresses. Use a real inbox, or delivered@resend.dev (Resend's test inbox).";
  if (err.status === 422) return "\n  -> Check EMAIL_FROM format: Name <address@your-verified-domain>.";
  return "";
};

try {
  const driver = new ResendEmailDriver({ apiKey, from, replyTo: process.env.EMAIL_REPLY_TO || undefined });
  const { providerRef } = await driver.send(to, "This is a test from Hosting.com Coffee Campaign. If you received it, email delivery works.", {
    subject: "Hosting.com Coffee Campaign: test email",
  });
  console.log(`Sent from ${from} to ${to}. Resend id: ${providerRef ?? "?"}. Check the inbox (and spam).`);
} catch (err) {
  console.error(`Send failed: ${err instanceof Error ? err.message : String(err)}${err instanceof EmailSendError ? hint(err) : ""}`);
  process.exit(1);
}
