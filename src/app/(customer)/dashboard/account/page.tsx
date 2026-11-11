import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/customer/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDhakaDate } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { getAccountSummary } from "@/server/services/customer-data";

import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "Your data · Hosting.com Perks" };

export default async function AccountPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/dashboard/account");
  const a = await getAccountSummary(session.sub);
  if (!a) redirect("/login");

  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn />
      <main className="mx-auto w-full max-w-md space-y-5 px-4 pt-4 pb-12">
        <Link href="/dashboard" className="text-muted-foreground inline-block py-2 text-sm">
          ← My vouchers
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Your data</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What we hold</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{a.email}</p>
            <p>{a.phone}</p>
            <p className="text-muted-foreground">
              Member since {formatDhakaDate(a.createdAt)} · {a._count.offerRequests} invoice(s) · {a._count.vouchers} voucher(s) · {a._count.redemptions} redemption(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download my data</CardTitle>
            <CardDescription>A JSON file with your profile, invoices, vouchers, redemptions and the SMS we sent you.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/me/export" className="bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center rounded-md font-medium" data-testid="export">
              Download (JSON)
            </a>
          </CardContent>
        </Card>

        <DeleteAccount activeVouchers={a.vouchers.length} redemptions={a._count.redemptions} />
      </main>
    </div>
  );
}
