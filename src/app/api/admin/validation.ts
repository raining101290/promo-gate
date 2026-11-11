import { NextResponse } from "next/server";

/** 400 with the first message per field: { fieldErrors: { [field]: message } } */
export function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return NextResponse.json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, { status: 400 });
}
