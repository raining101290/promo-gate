import { NextResponse } from "next/server";
import { z } from "zod";

import { getCustomerSession } from "@/server/auth/customer";
import { destroySession } from "@/server/auth/session";
import { deleteCustomer } from "@/server/services/customer-data";

const schema = z.object({ confirm: z.literal("DELETE", { message: 'Type DELETE to confirm' }) });

export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please log in again." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const result = await deleteCustomer(session.sub);
  await destroySession("customer");
  if (!result.ok) return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
  return NextResponse.json({ ok: true, redirectTo: "/?deleted=1" });
}
