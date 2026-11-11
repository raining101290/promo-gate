import "server-only";

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Dev/test-only message sink: one JSON line per message in OUTBOX_FILE (default ./.outbox.jsonl).
 * E2E tests read OTP codes from it. Refused in production like the console drivers.
 */
export function writeOutbox(entry: { channel: "sms" | "email"; to: string; subject?: string; body: string }) {
  const file = resolve(process.env.OUTBOX_FILE ?? "./.outbox.jsonl");
  appendFileSync(file, JSON.stringify({ ...entry, at: new Date().toISOString() }) + "\n");
}
