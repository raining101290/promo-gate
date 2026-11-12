import "server-only";

import { randomUUID } from "node:crypto";

import { isProduction } from "@/server/env";
import { writeOutbox } from "@/server/providers/outbox";

export interface EmailProvider {
  readonly name: string;
  send(to: string, body: string, opts?: { subject?: string }): Promise<{ providerRef?: string }>;
}

/** Dev driver: prints the email to the server terminal. Refuses to run in production. */
export class ConsoleEmailDriver implements EmailProvider {
  readonly name = "console";

  async send(to: string, body: string, opts?: { subject?: string }) {
    console.log(`\n[email:console] to=${to} subject="${opts?.subject ?? ""}"\n${body}\n`);
    return { providerRef: `console-${Date.now()}` };
  }
}

/** Dev/test driver: appends to OUTBOX_FILE (JSON lines). Refuses to run in production. */
export class FileEmailDriver implements EmailProvider {
  readonly name = "file";

  async send(to: string, body: string, opts?: { subject?: string }) {
    writeOutbox({ channel: "email", to, subject: opts?.subject, body });
    return { providerRef: `file-${Date.now()}` };
  }
}

/** Thrown when the email API refuses a message; `retryable: false` means sending again cannot help. */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly status: number | "network",
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

/**
 * Resend (resend.com) driver: POST https://api.resend.com/emails with a Bearer key. `from` must use a
 * domain verified in Resend (until then Resend only delivers to the account owner's own address).
 * Retries once on 429/5xx/network, with an Idempotency-Key so a retry can never send twice.
 */
export class ResendEmailDriver implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly cfg: { apiKey: string; from: string; replyTo?: string; url?: string; timeoutMs?: number; retryDelayMs?: number }) {}

  private async post(to: string, body: string, subject: string, idempotencyKey: string): Promise<{ id?: string }> {
    let res: Response;
    try {
      res = await fetch(this.cfg.url ?? "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          from: this.cfg.from,
          to: [to],
          subject,
          text: body,
          ...(this.cfg.replyTo ? { reply_to: this.cfg.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 10_000),
      });
    } catch (err) {
      throw new EmailSendError(`Network: ${err instanceof Error ? err.message : "request failed"}`, "network", true);
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // keep raw text for the error below
    }
    if (!res.ok) {
      const detail = String(json.message ?? text ?? "").slice(0, 200);
      throw new EmailSendError(
        `Resend ${res.status}${json.name ? ` ${String(json.name)}` : ""}: ${detail}`,
        res.status,
        res.status === 429 || res.status >= 500,
      );
    }
    return { id: typeof json.id === "string" ? json.id : undefined };
  }

  async send(to: string, body: string, opts?: { subject?: string }) {
    const subject = opts?.subject ?? "Hosting.com Coffee Campaign";
    const key = randomUUID();
    try {
      return { providerRef: (await this.post(to, body, subject, key)).id };
    } catch (err) {
      if (!(err instanceof EmailSendError) || !err.retryable) throw err;
      await new Promise((r) => setTimeout(r, this.cfg.retryDelayMs ?? 1000));
      return { providerRef: (await this.post(to, body, subject, key)).id };
    }
  }
}

let instance: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  const driver = process.env.EMAIL_DRIVER ?? "console";
  switch (driver) {
    case "console":
      if (isProduction) throw new Error("EMAIL_DRIVER=console is not allowed in production");
      instance = new ConsoleEmailDriver();
      return instance;
    case "file":
      if (isProduction) throw new Error("EMAIL_DRIVER=file is not allowed in production");
      instance = new FileEmailDriver();
      return instance;
    case "resend": {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!apiKey || !from) throw new Error("EMAIL_DRIVER=resend needs RESEND_API_KEY and EMAIL_FROM");
      instance = new ResendEmailDriver({ apiKey, from, replyTo: process.env.EMAIL_REPLY_TO || undefined });
      return instance;
    }
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}"`);
  }
}
