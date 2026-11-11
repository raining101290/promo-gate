import Link from "next/link";

import { requireStaffPage } from "@/server/auth/require-role";

export const metadata = { title: "Not allowed" };

export default async function ForbiddenPage() {
  await requireStaffPage();
  return (
    <div className="max-w-lg space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">You don&apos;t have access to that page</h1>
      <p className="text-muted-foreground">Your role can&apos;t open this section. Ask an admin if you need access.</p>
      <Link href="/admin" className="text-sm font-medium underline underline-offset-4">
        Back to your dashboard
      </Link>
    </div>
  );
}
