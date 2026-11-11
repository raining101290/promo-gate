import "server-only";

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
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}"`);
  }
}
