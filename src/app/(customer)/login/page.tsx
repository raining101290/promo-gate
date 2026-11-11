import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/safe-redirect";
import { getCustomerSession } from "@/server/auth/customer";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Hosting.com Perks" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  // getCustomerSession re-checks the DB, so a deleted customer's stale cookie can't loop /dashboard <-> /login.
  if (await getCustomerSession()) redirect(nextPath);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Hosting.com Perks</h1>
        <p className="text-muted-foreground mt-1 text-sm">Log in to see your coffee vouchers</p>
      </div>
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
