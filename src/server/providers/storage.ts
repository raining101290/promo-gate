import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { isProduction, sessionSecret } from "@/server/env";

export type UploadTicket = { url: string; method: "PUT"; headers: Record<string, string>; expiresInSeconds: number };

export interface StorageProvider {
  readonly name: string;
  /** Presigned PUT. The signature covers Content-Type and the exact Content-Length, so the client can't
   *  upload a different type or size than was approved. */
  createUploadUrl(key: string, opts: { contentType: string; contentLength: number; expiresInSeconds: number }): Promise<UploadTicket>;
  /** Short-lived presigned GET for viewing a private object. */
  createViewUrl(key: string, expiresInSeconds: number): Promise<string>;
  head(key: string): Promise<{ size: number; contentType: string | null } | null>;
  /** First `bytes` bytes (for magic-number checks). */
  readStart(key: string, bytes: number): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

/** Keys are server-generated; this guards the local driver against path tricks anyway. */
const KEY_RE = /^[a-z0-9]+(?:\/[a-z0-9][a-z0-9._-]*)+$/;
function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..")) throw new Error(`Invalid storage key: ${key}`);
}

/* ------------------------------- S3-compatible ------------------------------- */

export class S3StorageDriver implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    cfg: { region: string; endpoint?: string; forcePathStyle: boolean; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }

  async createUploadUrl(key: string, o: { contentType: string; contentLength: number; expiresInSeconds: number }): Promise<UploadTicket> {
    assertKey(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: o.contentType, ContentLength: o.contentLength }),
      { expiresIn: o.expiresInSeconds, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    // Content-Length is set by the browser from the body; it must equal the signed value.
    return { url, method: "PUT", headers: { "Content-Type": o.contentType }, expiresInSeconds: o.expiresInSeconds };
  }

  async createViewUrl(key: string, expiresInSeconds: number) {
    assertKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: "inline", ResponseCacheControl: "private, no-store" }),
      { expiresIn: expiresInSeconds },
    );
  }

  async head(key: string) {
    assertKey(key);
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return null;
      throw err;
    }
  }

  async readStart(key: string, bytes: number) {
    assertKey(key);
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
      return r.Body ? await r.Body.transformToByteArray() : null;
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/* ------------------------------- Local disk ------------------------------- */

type LocalOp = "put" | "get";
type LocalToken = { op: LocalOp; key: string; exp: number; ct: string; len: number };

function localSign(t: LocalToken): string {
  return createHmac("sha256", sessionSecret()).update(`storage\n${t.op}\n${t.key}\n${t.exp}\n${t.ct}\n${t.len}`).digest("base64url");
}

/**
 * Disk driver that mimics presigned URLs: files live under STORAGE_LOCAL_DIR and are only reachable via
 * /api/storage/local with an HMAC-signed, expiring token (see verifyLocalToken). Used in dev, and in production
 * on a single server (cPanel) when STORAGE_LOCAL_DIR is an absolute path outside the web root.
 */
export class LocalStorageDriver implements StorageProvider {
  readonly name = "local";

  constructor(private readonly root: string) {}

  private path(key: string) {
    assertKey(key);
    const p = resolve(this.root, key);
    if (!p.startsWith(resolve(this.root) + sep)) throw new Error("Path escapes storage root");
    return p;
  }

  private url(t: LocalToken) {
    const q = new URLSearchParams({ op: t.op, key: t.key, exp: String(t.exp), ct: t.ct, len: String(t.len), sig: localSign(t) });
    return `/api/storage/local?${q}`;
  }

  async createUploadUrl(key: string, o: { contentType: string; contentLength: number; expiresInSeconds: number }): Promise<UploadTicket> {
    this.path(key);
    const exp = Math.floor(Date.now() / 1000) + o.expiresInSeconds;
    return {
      url: this.url({ op: "put", key, exp, ct: o.contentType, len: o.contentLength }),
      method: "PUT",
      headers: { "Content-Type": o.contentType },
      expiresInSeconds: o.expiresInSeconds,
    };
  }

  async createViewUrl(key: string, expiresInSeconds: number) {
    this.path(key);
    return this.url({ op: "get", key, exp: Math.floor(Date.now() / 1000) + expiresInSeconds, ct: "", len: 0 });
  }

  /** Called by the route handler once the token is verified. */
  async write(key: string, data: Uint8Array, contentType: string) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
    await writeFile(`${p}.meta.json`, JSON.stringify({ contentType, size: data.byteLength }));
  }

  async read(key: string) {
    const p = this.path(key);
    const [data, meta] = await Promise.all([
      readFile(p),
      readFile(`${p}.meta.json`, "utf8")
        .then(JSON.parse)
        .catch(() => ({})),
    ]);
    return { data, contentType: (meta as { contentType?: string }).contentType ?? "application/octet-stream" };
  }

  async head(key: string) {
    const p = this.path(key);
    try {
      const s = await stat(p);
      const meta = JSON.parse(await readFile(`${p}.meta.json`, "utf8").catch(() => "{}")) as { contentType?: string };
      return { size: s.size, contentType: meta.contentType ?? null };
    } catch {
      return null;
    }
  }

  async readStart(key: string, bytes: number) {
    try {
      const fh = await open(this.path(key), "r");
      try {
        const buf = Buffer.alloc(bytes);
        const { bytesRead } = await fh.read(buf, 0, bytes, 0);
        return new Uint8Array(buf.subarray(0, bytesRead));
      } finally {
        await fh.close();
      }
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    const p = this.path(key);
    await rm(p, { force: true });
    await rm(`${p}.meta.json`, { force: true });
  }
}

/** Validates a /api/storage/local token. Returns the parsed token or null (bad signature / expired). */
export function verifyLocalToken(q: URLSearchParams, expectedOp: LocalOp): LocalToken | null {
  const t: LocalToken = {
    op: q.get("op") as LocalOp,
    key: q.get("key") ?? "",
    exp: Number(q.get("exp")),
    ct: q.get("ct") ?? "",
    len: Number(q.get("len")),
  };
  const sig = Buffer.from(q.get("sig") ?? "", "base64url");
  const want = Buffer.from(localSign(t), "base64url");
  if (t.op !== expectedOp || sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  if (!Number.isFinite(t.exp) || t.exp < Math.floor(Date.now() / 1000)) return null;
  return t;
}

/* ------------------------------- selection ------------------------------- */

let instance: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") {
    const dir = process.env.STORAGE_LOCAL_DIR;
    // Production must name the folder explicitly (a relative default would land inside the release and vanish on deploy).
    if (isProduction && !dir?.startsWith("/")) throw new Error("STORAGE_DRIVER=local in production needs an absolute STORAGE_LOCAL_DIR");
    instance = new LocalStorageDriver(resolve(dir ?? "./.storage"));
    return instance;
  }
  if (driver === "s3") {
    const { STORAGE_BUCKET, STORAGE_REGION, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY } = process.env;
    if (!STORAGE_BUCKET || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_DRIVER=s3 needs STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY");
    }
    instance = new S3StorageDriver(STORAGE_BUCKET, {
      region: STORAGE_REGION || "auto",
      endpoint: STORAGE_ENDPOINT,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      accessKeyId: STORAGE_ACCESS_KEY_ID,
      secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    });
    return instance;
  }
  throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
}

/** Lifetime of presigned view URLs (seconds). */
export function signedUrlTtl(): number {
  const n = Number(process.env.STORAGE_SIGNED_URL_TTL ?? 300);
  return Number.isFinite(n) && n >= 10 && n <= 3600 ? n : 300;
}
