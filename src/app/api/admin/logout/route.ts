import { NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";
import { publicUrl } from "@/lib/public-url";

export async function POST(req: Request) {
  await destroySession("staff");
  return NextResponse.redirect(publicUrl("/admin/login", req.url), 303);
}
