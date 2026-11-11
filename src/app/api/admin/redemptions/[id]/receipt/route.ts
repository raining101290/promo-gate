import { NextResponse } from "next/server";
import { z } from "zod";

import { PERMISSIONS, withStaff } from "@/server/auth/require-role";
import { issueReceiptViewUrl } from "@/server/services/receipts";
import { badId, readId } from "@/app/api/id-param";

/** Staff receipt viewing: redirects to a short-lived presigned URL (never a permanent link). Audited. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withStaff(PERMISSIONS.viewRedemptions, async (staff) => {
    const id = await readId(params);
    if (!id) return badId();
    const thumb = z.enum(["1"]).optional().safeParse(new URL(req.url).searchParams.get("thumb") ?? undefined).data === "1";
    const url = await issueReceiptViewUrl(id, staff.id, { audit: !thumb });
    if (!url) return NextResponse.json({ ok: false, error: "No receipt uploaded." }, { status: 404 });
    const res = NextResponse.redirect(new URL(url, req.url), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  });
}
