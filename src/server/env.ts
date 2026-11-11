// Env access shared by Node and the Edge middleware. Keep this free of Node-only imports.

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return secret;
}

export const isProduction = process.env.NODE_ENV === "production";

/** Public base URL for links in SMS/email, without trailing slash. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
