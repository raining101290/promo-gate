import "server-only";

import { isProduction } from "@/server/env";
import { writeOutbox } from "@/server/providers/outbox";

export interface SmsProvider {
  readonly name: string;
  /** `to` is E.164. Resolves with the provider's message reference when available; throws on failure. */
  send(to: string, body: string): Promise<{ providerRef?: string }>;
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
 * Generic HTTP driver for Bangladeshi bulk-SMS gateways (the common BulkSMSBD-style API):
 * POST form fields api_key, senderid, number (8801XXXXXXXXX, no "+"), message, type=text.
 * Success = HTTP 2xx and, if the body is JSON with a `response_code`, that code is 202/200.
 * Field names differ slightly between gateways; adjust `formFor` when onboarding a provider.
 */
export class HttpSmsDriver implements SmsProvider {
  readonly name = "http";

  constructor(
    private readonly cfg: { url: string; apiKey: string; senderId: string; timeoutMs?: number },
  ) {}

  private formFor(to: string, body: string) {
    return new URLSearchParams({
      api_key: this.cfg.apiKey,
      senderid: this.cfg.senderId,
      number: to.replace(/^\+/, ""),
      message: body,
      type: "text",
    });
  }

  async send(to: string, body: string) {
    const res = await fetch(this.cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: this.formFor(to, body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 10_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Some gateways answer with plain text on success.
    }
    const code = json?.response_code ?? json?.status_code;
    if (code != null && ![200, 202, "200", "202"].includes(code as number | string)) {
      throw new Error(`Gateway error ${String(code)}: ${String(json?.error_message ?? json?.message ?? text).slice(0, 200)}`);
    }
    const ref = json?.message_id ?? json?.request_id ?? json?.id;
    return { providerRef: ref != null ? String(ref) : undefined };
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
    case "http": {
      const url = process.env.SMS_API_URL;
      const apiKey = process.env.SMS_API_KEY;
      const senderId = process.env.SMS_SENDER_ID;
      if (!url || !apiKey || !senderId) throw new Error("SMS_DRIVER=http needs SMS_API_URL, SMS_API_KEY and SMS_SENDER_ID");
      instance = new HttpSmsDriver({ url, apiKey, senderId });
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
