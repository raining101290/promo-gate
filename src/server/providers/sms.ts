import "server-only";

import { isProduction } from "@/server/env";
import { writeOutbox } from "@/server/providers/outbox";

export interface SmsProvider {
  readonly name: string;
  /** `to` is E.164. Resolves with the provider's message reference when available; throws on failure. */
  send(to: string, body: string): Promise<{ providerRef?: string }>;
  /** Remaining prepaid credit in taka, when the gateway exposes it. */
  balance?(): Promise<number>;
}

/** Dev driver: prints the message to the server terminal. Refuses to run in production. */
export class ConsoleSmsDriver implements SmsProvider {
  readonly name = "console";

  async send(to: string, body: string) {
    console.log(`\n[sms:console] to=${to}\n${body}\n`);
    return { providerRef: `console-${Date.now()}` };
  }
}

/**
 * Thrown by drivers when the gateway refuses a message. `retryable: false` means sending the same
 * message again cannot succeed (bad number, no balance, IP not whitelisted...), so sendSms stops early.
 */
export class SmsGatewayError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SmsGatewayError";
  }
}

/** BulkSMSBD response codes (from their API docs). Everything except 202 is a failure. */
export const BULKSMSBD_CODES: Record<string, { meaning: string; retryable: boolean }> = {
  "1001": { meaning: "Invalid number", retryable: false },
  "1002": { meaning: "Sender ID not correct or disabled", retryable: false },
  "1003": { meaning: "Required fields missing", retryable: false },
  "1005": { meaning: "Gateway internal error", retryable: true },
  "1006": { meaning: "Balance validity not available", retryable: false },
  "1007": { meaning: "Balance insufficient", retryable: false },
  "1011": { meaning: "User ID not found", retryable: false },
  "1012": { meaning: "Masking SMS must be sent in Bengali", retryable: false },
  "1013": { meaning: "Sender ID has no gateway for this API key", retryable: false },
  "1014": { meaning: "Sender type name not found for this sender", retryable: false },
  "1015": { meaning: "Sender ID has no valid gateway for this API key", retryable: false },
  "1016": { meaning: "No active price for this sender ID", retryable: false },
  "1017": { meaning: "No price info for this sender ID", retryable: false },
  "1018": { meaning: "Account owner is disabled", retryable: false },
  "1019": { meaning: "Price for this sender type is disabled on the account", retryable: false },
  "1020": { meaning: "Parent account not found", retryable: false },
  "1021": { meaning: "Parent account has no active price", retryable: false },
  "1031": { meaning: "Account not verified", retryable: false },
  "1032": { meaning: "Server IP not whitelisted", retryable: false },
};

/**
 * BulkSMSBD (bulksmsbd.net) driver. POST form fields api_key, type=text, number (8801XXXXXXXXX,
 * no "+"), senderid, message. The gateway answers HTTP 200 with JSON
 * `{"response_code":202,"success_message":"...","error_message":""}`; any other code is a failure.
 * Sending only works from whitelisted server IPs (code 1032 otherwise).
 */
export class BulkSmsBdDriver implements SmsProvider {
  readonly name = "bulksmsbd";

  constructor(private readonly cfg: { url: string; balanceUrl: string; apiKey: string; senderId: string; timeoutMs?: number }) {}

  private async post(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 10_000),
      });
    } catch (err) {
      // Network error / timeout: worth retrying.
      throw new SmsGatewayError(`Network: ${err instanceof Error ? err.message : "request failed"}`, "network", true);
    }
    const text = await res.text();
    if (!res.ok) throw new SmsGatewayError(`HTTP ${res.status}: ${text.slice(0, 200)}`, `http_${res.status}`, res.status >= 500);
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new SmsGatewayError(`Unexpected response: ${text.slice(0, 200)}`, "bad_response", true);
    }
  }

  private static check(json: Record<string, unknown>): void {
    const code = String(json.response_code ?? "");
    if (code === "202") return;
    const known = BULKSMSBD_CODES[code];
    const detail = String(json.error_message || known?.meaning || "Unknown error").slice(0, 200);
    throw new SmsGatewayError(`Gateway ${code || "?"}: ${detail}`, code || "unknown", known?.retryable ?? true);
  }

  async send(to: string, body: string) {
    const json = await this.post(this.cfg.url, {
      api_key: this.cfg.apiKey,
      type: "text",
      number: to.replace(/^\+/, ""),
      senderid: this.cfg.senderId,
      message: body,
    });
    BulkSmsBdDriver.check(json);
    const ref = json.message_id ?? json.request_id;
    return { providerRef: ref != null ? String(ref) : undefined };
  }

  /** Remaining credit in taka (as reported by the gateway). */
  async balance(): Promise<number> {
    const json = await this.post(this.cfg.balanceUrl, { api_key: this.cfg.apiKey });
    BulkSmsBdDriver.check(json);
    const n = Number(json.balance);
    if (!Number.isFinite(n)) throw new SmsGatewayError("Balance missing in response", "bad_response", true);
    return Math.round(n * 100) / 100;
  }
}

/** Dev/test driver: appends to OUTBOX_FILE (JSON lines). Refuses to run in production. */
export class FileSmsDriver implements SmsProvider {
  readonly name = "file";

  async send(to: string, body: string) {
    writeOutbox({ channel: "sms", to, body });
    return { providerRef: `file-${Date.now()}` };
  }
}

let instance: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (instance) return instance;
  const driver = process.env.SMS_DRIVER ?? "console";
  switch (driver) {
    case "console":
      if (isProduction) throw new Error("SMS_DRIVER=console is not allowed in production");
      instance = new ConsoleSmsDriver();
      return instance;
    case "bulksmsbd":
    case "http": {
      const url = process.env.SMS_API_URL || "https://bulksmsbd.net/api/smsapi";
      const apiKey = process.env.SMS_API_KEY;
      const senderId = process.env.SMS_SENDER_ID;
      if (!apiKey || !senderId) throw new Error(`SMS_DRIVER=${driver} needs SMS_API_KEY and SMS_SENDER_ID`);
      const balanceUrl = process.env.SMS_BALANCE_URL || url.replace(/smsapi\/?$/, "getBalanceApi");
      instance = new BulkSmsBdDriver({ url, balanceUrl, apiKey, senderId });
      return instance;
    }
    case "file":
      if (isProduction) throw new Error("SMS_DRIVER=file is not allowed in production");
      instance = new FileSmsDriver();
      return instance;
    default:
      throw new Error(`Unknown SMS_DRIVER "${driver}"`);
  }
}
