// Edge-safe (used by middleware). Builds the Content-Security-Policy for one response.

/** Origin the browser talks to for presigned receipt PUT/GET (none for the local driver: same origin). */
export function storageOrigin(): string | null {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "s3") return null;
  if (process.env.CSP_STORAGE_ORIGIN) return process.env.CSP_STORAGE_ORIGIN;
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.STORAGE_ENDPOINT;
  try {
    if (endpoint) {
      const u = new URL(endpoint);
      // Path-style (MinIO): https://host/bucket/key. Virtual-hosted (R2/S3): https://bucket.host/key.
      return process.env.STORAGE_FORCE_PATH_STYLE === "true" || !bucket ? u.origin : `${u.protocol}//${bucket}.${u.host}`;
    }
    return bucket ? `https://${bucket}.s3.${process.env.STORAGE_REGION || "us-east-1"}.amazonaws.com` : null;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const storage = storageOrigin() ?? "";
  return [
    "default-src 'self'",
    // strict-dynamic + nonce: only Next's own (nonced) scripts and what they load. wasm-unsafe-eval lets
    // the QR decoder compile its WebAssembly; unsafe-eval is needed by React only in development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind/next-font inject <style> and React uses style attributes.
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data: blob:", storage].filter(Boolean).join(" "),
    "font-src 'self' data:",
    ["connect-src 'self'", storage, isDev ? "ws: wss:" : ""].filter(Boolean).join(" "),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
