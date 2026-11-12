import { NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";
import { publicUrl } from "@/lib/public-url";

export async function POST(req: Request) {
  await destroySession("customer");
  return NextResponse.redirect(publicUrl("/login", req.url), 303);
}
