import { NextResponse } from "next/server";

import { getStorage, LocalStorageDriver, verifyLocalToken } from "@/server/providers/storage";

// Dev-only stand-in for S3 presigned URLs. Every request needs a valid, unexpired HMAC token.

function localDriver(): LocalStorageDriver | null {
  // Check config first: in production getStorage() refuses the local driver (would be a 500, not a 404).
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") return null;
  const s = getStorage();
  return s instanceof LocalStorageDriver ? s : null;
}

const deny = (status: number, msg: string) => new NextResponse(msg, { status, headers: { "Cache-Control": "no-store" } });

export async function PUT(req: Request) {
  const driver = localDriver();
  if (!driver) return deny(404, "Not found");
  const t = verifyLocalToken(new URL(req.url).searchParams, "put");
  if (!t) return deny(403, "Invalid or expired upload URL");
  if (req.headers.get("content-type") !== t.ct) return deny(403, "Content-Type does not match the signed upload");

  const data = new Uint8Array(await req.arrayBuffer());
  if (data.byteLength !== t.len) return deny(403, "Content-Length does not match the signed upload");
  await driver.write(t.key, data, t.ct);
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  const driver = localDriver();
  if (!driver) return deny(404, "Not found");
  const t = verifyLocalToken(new URL(req.url).searchParams, "get");
  if (!t) return deny(403, "Invalid or expired link");
  try {
    const { data, contentType } = await driver.read(t.key);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return deny(404, "Not found");
  }
}
