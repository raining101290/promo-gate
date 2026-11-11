import { NextResponse } from "next/server";
import { z } from "zod";

/** Route ids are cuids (or seed slugs like "seed_partner_bean"): lowercase alphanumerics/underscore. */
export const idParamSchema = z.string().regex(/^[a-z0-9_]{3,64}$/);

/** Validated `[id]` path param, or null (callers answer with badId()). */
export async function readId(params: Promise<{ id: string }>): Promise<string | null> {
  const parsed = idParamSchema.safeParse((await params).id);
  return parsed.success ? parsed.data : null;
}

export const badId = () => NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
