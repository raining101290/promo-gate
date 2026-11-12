import type { Metadata } from "next";

import { SiteHeader } from "@/components/customer/site-header";
import { GuidePage } from "@/components/guide/guide-page";
import { CUSTOMER_FAQ, CUSTOMER_GUIDE } from "@/lib/guide/content";
import { getCustomerSession } from "@/server/auth/customer";

export const metadata: Metadata = { title: "How it works · Hosting.com Coffee Campaign" };

export default async function CustomerGuidePage() {
  const loggedIn = !!(await getCustomerSession());
  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn={loggedIn} wide />
      <GuidePage
        audience="customers"
        title="How to get and use your coffee voucher"
        lead="From a paid hosting.com invoice to a discounted bill at a partner café, in eleven short steps."
        parts={CUSTOMER_GUIDE}
        faq={CUSTOMER_FAQ}
        cta={loggedIn ? { href: "/dashboard", label: "See my vouchers" } : { href: "/#submit", label: "Claim your voucher" }}
      />
    </div>
  );
}
