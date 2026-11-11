import { NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";

export async function POST(req: Request) {
  await destroySession("customer");
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
