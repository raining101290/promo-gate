import { NextResponse } from "next/server";

import { receiptCompleteSchema } from "@/lib/schemas/receipt";
import { getCustomerSession } from "@/server/auth/customer";
import { completeReceiptUpload } from "@/server/services/receipts";

import { receiptFailure } from "../messages";
import { badId, readId } from "@/app/api/id-param";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please log in again." }, { status: 401 });
  const parsed = receiptCompleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const id = await readId(params);
    if (!id) return badId();
  const result = await completeReceiptUpload(session.sub, id, parsed.data);
  if (!result.ok) return receiptFailure(result);
  return NextResponse.json({ ok: true, replaced: result.replaced });
}
