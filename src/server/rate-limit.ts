import "server-only";

import { db } from "@/server/db";

export type RateLimitResult = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Records one hit for `key` and reports whether it is within `limit` hits per `windowMs`. */
  hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  /** Forgets all hits for `key`. */
  reset(key: string): Promise<void>;
}

/** Postgres-backed sliding window. Works across multiple app instances; rejected hits are not stored. */
export class DbRateLimiter implements RateLimiter {
  async hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const since = new Date(Date.now() - windowMs);
    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rl:${key}`}))`;
      await tx.rateLimitHit.deleteMany({ where: { key, createdAt: { lte: since } } });
      const hits = await tx.rateLimitHit.findMany({
        where: { key },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
        take: limit,
      });
      if (hits.length >= limit) {
        const retryAt = hits[0].createdAt.getTime() + windowMs;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) };
      }
      await tx.rateLimitHit.create({ data: { key } });
      return { allowed: true, remaining: limit - hits.length - 1 };
    });
  }

  async reset(key: string): Promise<void> {
    await db.rateLimitHit.deleteMany({ where: { key } });
  }
}

let instance: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  instance ??= new DbRateLimiter();
  return instance;
}

const MIN = 60 * 1000;

/**
 * Every rate limit in the app, in one place. Keys are built by callers as `<policy>:<subject>`.
 * Change numbers here, not at call sites.
 */
export const RATE_LIMITS = {
  /** Codes sent to one email/phone. */
  otpRequestTarget: { limit: 3, windowMs: 15 * MIN },
  /** Codes requested from one IP across all targets (stops SMS pumping / enumeration). */
  otpRequestIp: { limit: 10, windowMs: 15 * MIN },
  /** Verify attempts from one IP / against one target (on top of 5 tries per code). */
  otpVerifyIp: { limit: 30, windowMs: 15 * MIN },
  otpVerifyTarget: { limit: 15, windowMs: 15 * MIN },
  /** Public invoice submissions per IP. */
  offerSubmitIp: { limit: 5, windowMs: 60 * MIN },
  /** Wrong cashier PINs per (branch, voucher); the 5th locks the voucher. */
  pinFailure: { limit: 5, windowMs: 15 * MIN },
  /** Receipt upload URLs per redemption. */
  receiptUpload: { limit: 10, windowMs: 60 * MIN },
  /** Staff password attempts per (IP, email). */
  staffLogin: { limit: 10, windowMs: 15 * MIN },
  /** Own-password change attempts per staff member (wrong current password guesses). */
  passwordChange: { limit: 5, windowMs: 15 * MIN },
  /** Customer data exports per customer. */
  dataExport: { limit: 5, windowMs: 60 * MIN },
} as const satisfies Record<string, { limit: number; windowMs: number }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

/** Counts one hit against a named policy for `subject` (an IP, target, id…). */
export function limit(policy: RateLimitPolicy, subject: string): Promise<RateLimitResult> {
  const p = RATE_LIMITS[policy];
  return getRateLimiter().hit(`${policy}:${subject}`, p.limit, p.windowMs);
}

export function resetLimit(policy: RateLimitPolicy, subject: string): Promise<void> {
  return getRateLimiter().reset(`${policy}:${subject}`);
}

/**
 * Client IP for rate limiting. Only trustworthy when a proxy you control OVERWRITES the header:
 * - Vercel / most CDNs: x-forwarded-for / x-real-ip are set by the platform (default here).
 * - Self-hosted nginx: `proxy_set_header X-Real-IP $remote_addr;` and set CLIENT_IP_HEADER=x-real-ip.
 * With no proxy, clients can spoof this header, so IP limits become advisory (per-target limits still hold).
 */
export function clientIp(headers: Headers): string {
  const configured = process.env.CLIENT_IP_HEADER?.toLowerCase();
  if (configured) return headers.get(configured)?.split(",")[0]?.trim() || "unknown";
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || headers.get("x-real-ip")?.trim() || "unknown";
}
