import "server-only";

import { cookies } from "next/headers";

import { isProduction } from "@/server/env";
import { cookieFor, signSessionToken, verifySessionToken, type SessionPayload } from "@/server/auth/token";

export type { SessionPayload };

type Kind = SessionPayload["kind"];

/** Signs the payload and sets the cookie for its kind. Call from a route handler or server action. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const { name, maxAge } = cookieFor(payload.kind);
  const jar = await cookies();
  jar.set(name, token, { httpOnly: true, secure: isProduction, sameSite: "lax", path: "/", maxAge });
}

export async function readSession(kind: Kind): Promise<SessionPayload | null> {
  const jar = await cookies();
  const session = await verifySessionToken(jar.get(cookieFor(kind).name)?.value);
  return session?.kind === kind ? session : null;
}

export async function destroySession(kind: Kind): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieFor(kind).name);
}

/** Customer session or null; use in customer pages as a second check after middleware. */
export async function readCustomerSession() {
  const session = await readSession("customer");
  return session?.kind === "customer" ? session : null;
}

/** Staff session (signature only). Use requireStaff() for authorization: it re-checks the DB. */
export async function readStaffSession() {
  const session = await readSession("staff");
  return session?.kind === "staff" ? session : null;
}
