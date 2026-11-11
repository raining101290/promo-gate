import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, STAFF_SESSION_COOKIE, verifySessionToken } from "@/server/auth/token";
import { buildCsp } from "@/server/csp";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const isDev = process.env.NODE_ENV !== "production";

/**
 * Runs on every request (see matcher):
 * 1. CSRF backstop: state-changing /api calls must come from our own origin. (SameSite=Lax cookies are
 *    the primary defence; browsers always send Origin on cross-site POSTs.) Cron uses a bearer secret.
 * 2. Coarse auth gates for /admin and /dashboard (pages and routes still authorise themselves).
 * 3. A per-request nonce CSP; Next.js reads it from the request header and nonces its own scripts.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method) && !pathname.startsWith("/api/cron/")) {
    const origin = req.headers.get("origin");
    if (origin && !allowedOrigins(req).has(origin)) {
      return NextResponse.json({ ok: false, error: "Cross-origin request blocked" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const staff = await verifySessionToken(req.cookies.get(STAFF_SESSION_COOKIE)?.value);
    if (staff?.kind !== "staff") return redirectToLogin(req, "/admin/login", pathname + search);
  } else if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const customer = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (customer?.kind !== "customer") return redirectToLogin(req, "/login", pathname + search);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, isDev);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

function allowedOrigins(req: NextRequest) {
  const set = new Set([req.nextUrl.origin]);
  try {
    if (process.env.APP_URL) set.add(new URL(process.env.APP_URL).origin);
  } catch {
    // ignore malformed APP_URL
  }
  return set;
}

function redirectToLogin(req: NextRequest, loginPath: string, next: string) {
  const url = new URL(loginPath, req.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except build assets and static files (those carry the static headers from next.config).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|vendor/).*)"],
};
