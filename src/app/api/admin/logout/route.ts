import { NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";

export async function POST(req: Request) {
  await destroySession("staff");
  return NextResponse.redirect(new URL("/admin/login", req.url), 303);
}
