import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Static security headers for every response. The CSP is per-request (nonce) and set in src/middleware.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy twin of CSP frame-ancestors 'none'
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera only for our own pages (receipt photos, QR scanner); nothing else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // E2E runs its own dev server; a separate build dir lets it run next to `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Docker/VPS builds set NEXT_OUTPUT=standalone (self-contained server.js); Vercel ignores it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Routes using the dev storage/outbox drivers build file paths at runtime, so the file tracer pulls in the
  // whole project (tests, docs, dev uploads). Nothing below is read at runtime; keep it out of the standalone bundle.
  // (Next also copies .env files into standalone itself; deploy/cpanel/package.sh strips them and refuses leaks.)
  outputFileTracingExcludes: {
    "/**": [
      ".env*",
      ".storage/**",
      ".outbox*",
      ".git/**",
      "*.md",
      "docs/**",
      "tests/**",
      "test-results/**",
      "playwright-report/**",
      "scripts/**",
      "src/**",
      "prisma/**",
      "deploy/**",
      "Dockerfile",
      "docker-compose.yml",
      "*.config.{ts,mjs,js}",
      "prisma7.config.ts",
      "components.json",
      "vercel.json",
      "package-lock.json",
      "tsconfig*.json",
      "*.tsbuildinfo",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
