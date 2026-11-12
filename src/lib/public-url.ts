/**
 * Absolute URL on the public site for redirects. Never resolve against `req.url` alone: behind a proxy
 * (cPanel Passenger/LiteSpeed, Docker) Next.js reports its own listen address (e.g. https://0.0.0.0:3000), so
 * a redirect built from it leaves the site (and the CSP `form-action 'self'` blocks it after a form POST).
 * In production APP_URL is the canonical origin; in dev the request URL is right. Works in middleware too.
 */
export function publicUrl(path: string, reqUrl: string): URL {
  const appUrl = process.env.NODE_ENV === "production" ? process.env.APP_URL : undefined;
  if (appUrl) {
    try {
      return new URL(path, appUrl);
    } catch {
      // malformed APP_URL: fall back to the request URL
    }
  }
  return new URL(path, reqUrl);
}
