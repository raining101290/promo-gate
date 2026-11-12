import "server-only";

import type { EmailStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export const EMAIL_LOG_PAGE_SIZE = 50;

/** Which driver is configured and the sending address (shown on the Email screen; never the API key). */
export function emailSetup(): { driver: string; from: string | null } {
  const driver = process.env.EMAIL_DRIVER ?? "console";
  const from = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM ?? null;
  return { driver, from: driver === "resend" ? from : null };
}

/** Delivery log (newest first). Subjects only: bodies are never stored. */
export async function listEmailLog(f: { email?: string; status?: EmailStatus; purpose?: string; page: number }) {
  const where: Prisma.EmailLogWhereInput = { toEmail: f.email, status: f.status, purpose: f.purpose };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [rows, total, last24] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * EMAIL_LOG_PAGE_SIZE,
      take: EMAIL_LOG_PAGE_SIZE,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        provider: true,
        providerRef: true,
        status: true,
        error: true,
        purpose: true,
        createdAt: true,
        redemptionId: true,
      },
    }),
    db.emailLog.count({ where }),
    db.emailLog.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  const count = (s: EmailStatus) => last24.find((g) => g.status === s)?._count ?? 0;
  return { rows, total, pages: Math.max(1, Math.ceil(total / EMAIL_LOG_PAGE_SIZE)), sent24h: count("SENT"), failed24h: count("FAILED") };
}
