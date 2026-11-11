import { NextResponse } from "next/server";

import { receiptUploadRequestSchema } from "@/lib/schemas/receipt";
import { getCustomerSession } from "@/server/auth/customer";
import { createReceiptUpload } from "@/server/services/receipts";

import { receiptFailure } from "../messages";
import { badId, readId } from "@/app/api/id-param";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please log in again." }, { status: 401 });
  const parsed = receiptUploadRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file" }, { status: 400 });

  const id = await readId(params);
    if (!id) return badId();
  const result = await createReceiptUpload(session.sub, id, parsed.data);
  if (!result.ok) return receiptFailure(result);
  return NextResponse.json({ ok: true, key: result.key, upload: result.upload }, { headers: { "Cache-Control": "no-store" } });
}
