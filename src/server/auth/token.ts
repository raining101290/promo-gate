// Edge-safe JWT helpers (jose only). Imported by middleware, so no Node APIs or "server-only" here.
import { jwtVerify, SignJWT } from "jose";

import { sessionSecret } from "@/server/env";

export const SESSION_COOKIE = "perks_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (customers)

// Staff use a separate cookie (so staff + customer sessions can coexist) with a much shorter life.
export const STAFF_SESSION_COOKIE = "perks_staff_session";
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export function cookieFor(kind: "customer" | "staff") {
  return kind === "staff"
    ? { name: STAFF_SESSION_COOKIE, maxAge: STAFF_SESSION_MAX_AGE_SECONDS }
    : { name: SESSION_COOKIE, maxAge: SESSION_MAX_AGE_SECONDS };
}

export type StaffRoleName = "SUPPORT" | "FINANCE" | "ADMIN";

export type SessionPayload =
  | { sub: string; kind: "customer" }
  /** sv = StaffUser.sessionVersion at login; a mismatch means the session was revoked. */
  | { sub: string; kind: "staff"; role: StaffRoleName; sv: number };

const ALG = "HS256";

function key() {
  return new TextEncoder().encode(sessionSecret());
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const claims = payload.kind === "staff" ? { kind: payload.kind, role: payload.role, sv: payload.sv } : { kind: payload.kind };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${cookieFor(payload.kind).maxAge}s`)
    .sign(key());
}

/** Returns the payload, or null for a missing, tampered, expired or malformed token. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] });
    const sub = payload.sub;
    if (typeof sub !== "string") return null;
    if (payload.kind === "customer") return { sub, kind: "customer" };
    if (payload.kind === "staff" && (payload.role === "SUPPORT" || payload.role === "FINANCE" || payload.role === "ADMIN")) {
      // Tokens from before session versions existed count as version 0.
      return { sub, kind: "staff", role: payload.role, sv: typeof payload.sv === "number" ? payload.sv : 0 };
    }
    return null;
  } catch {
    return null;
  }
}
