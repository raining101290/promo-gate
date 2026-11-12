import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { expiresInLabel } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { branchAcceptsVouchers, getBranchByCode, listRedeemableVouchers } from "@/server/services/redemptions";

export const metadata: Metadata = { title: "Use your voucher · Hosting.com Coffee Campaign" };

/** Entry from the counter standee QR: /r/<branchCode>[?v=<voucherId> from the in-app scanner]. */
export default async function BranchEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchCode: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { branchCode } = await params;
  const { v } = await searchParams;

  const session = await getCustomerSession();
  if (!session) {
    const back = `/r/${branchCode}${v ? `?v=${encodeURIComponent(v)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const branch = await getBranchByCode(branchCode);
  if (!branch) notFound();
  const accepting = branchAcceptsVouchers(branch);
  const now = new Date();
  const vouchers = accepting ? await listRedeemableVouchers(session.sub, now) : [];

  // Scanner preselected a voucher: skip the picker.
  if (accepting && v && vouchers.some((x) => x.id === v && !x.lockedUntil)) redirect(`/r/${branchCode}/redeem?v=${encodeURIComponent(v)}`);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pt-6 pb-12">
      <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Hosting.com Coffee Campaign</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight" data-testid="branch-name">
        {branch.partner.name}
      </h1>
      <p className="text-muted-foreground">
        {branch.name} · {branch.area}
      </p>

      {!accepting ? (
        <Card className="mt-6">
          <CardContent className="space-y-2">
            <p className="font-medium">This café isn&apos;t accepting Hosting.com vouchers right now.</p>
            <p className="text-muted-foreground text-sm">Your voucher is still safe. You can use it at another partner branch.</p>
            <Link href="/dashboard" className="inline-block pt-2 text-sm font-medium underline underline-offset-4">
              My vouchers
            </Link>
          </CardContent>
        </Card>
      ) : vouchers.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="space-y-2">
            <p className="font-medium">You don&apos;t have a voucher ready to use.</p>
            <p className="text-muted-foreground text-sm">Vouchers appear once support approves your invoice.</p>
            <Link href="/dashboard" className="inline-block pt-2 text-sm font-medium underline underline-offset-4">
              My vouchers
            </Link>
          </CardContent>
        </Card>
      ) : (
        <section className="mt-6 space-y-3" aria-labelledby="pick">
          <h2 id="pick" className="font-semibold">
            Choose a voucher to use here
          </h2>
          {vouchers.map((voucher) =>
            voucher.lockedUntil ? (
              <div key={voucher.id} className="bg-muted text-muted-foreground rounded-xl p-4">
                <p className="text-xl font-semibold">{voucher.headline}</p>
                <p className="text-sm">Locked after too many wrong PINs. Try again in a few minutes.</p>
              </div>
            ) : (
              <Link
                key={voucher.id}
                href={`/r/${branchCode}/redeem?v=${voucher.id}`}
                data-testid="voucher-option"
                className="bg-primary text-primary-foreground block rounded-xl p-4 shadow-sm active:opacity-90"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold tracking-tight">{voucher.headline}</p>
                  <span className="text-sm font-medium">Use →</span>
                </div>
                {voucher.conditions.length > 0 && <p className="mt-1 text-sm opacity-90">{voucher.conditions.join(" · ")}</p>}
                <p className="mt-2 text-xs opacity-75">
                  {voucher.campaignName} · {expiresInLabel(voucher.expiresAt, now)}
                </p>
              </Link>
            ),
          )}
        </section>
      )}
    </main>
  );
}
