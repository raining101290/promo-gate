import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { expiresInLabel } from "@/lib/time";
import { getCustomerSession } from "@/server/auth/customer";
import { branchAcceptsVouchers, getBranchByCode, listRedeemableVouchers } from "@/server/services/redemptions";

import { RedeemFlow } from "./redeem-flow";

export const metadata: Metadata = { title: "Redeem · Hosting.com Perks" };

export default async function RedeemPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchCode: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { branchCode } = await params;
  const { v } = await searchParams;

  const session = await getCustomerSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/r/${branchCode}`)}`);

  const branch = await getBranchByCode(branchCode);
  if (!branch) notFound();
  if (!branchAcceptsVouchers(branch)) redirect(`/r/${branchCode}`); // entry page explains

  const now = new Date();
  const vouchers = (await listRedeemableVouchers(session.sub, now)).filter((x) => !x.lockedUntil);
  if (vouchers.length === 0) redirect(`/r/${branchCode}`);
  // A requested voucher that isn't usable (e.g. just redeemed, from a stale Back page) must not silently
  // turn into a different voucher: send the customer back to the fresh list instead.
  const selected = v ? vouchers.find((x) => x.id === v) : vouchers[0];
  if (!selected) redirect(`/r/${branchCode}`);

  return (
    <RedeemFlow
      branch={{ code: branch.branchCode, name: branch.name, area: branch.area, partnerName: branch.partner.name }}
      vouchers={vouchers.map((x) => ({
        id: x.id,
        headline: x.headline,
        conditions: x.conditions,
        terms: x.terms,
        expires: expiresInLabel(x.expiresAt, now),
      }))}
      initialVoucherId={selected.id}
    />
  );
}
