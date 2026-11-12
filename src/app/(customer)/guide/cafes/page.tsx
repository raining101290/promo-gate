import type { Metadata } from "next";

import { SiteHeader } from "@/components/customer/site-header";
import { GuidePage } from "@/components/guide/guide-page";
import { CAFE_FAQ, CAFE_GUIDE } from "@/lib/guide/content";
import { getCustomerSession } from "@/server/auth/customer";

export const metadata: Metadata = { title: "For partner cafés · Hosting.com Coffee Campaign" };

export default async function CafeGuidePage() {
  const loggedIn = !!(await getCustomerSession());
  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn={loggedIn} wide />
      <GuidePage
        audience="cafes"
        title="Accepting Hosting.com vouchers at your café"
        lead="Your cashiers need no account: they type your branch PIN on the customer's phone. Hosting.com pays you back for every verified redemption."
        parts={CAFE_GUIDE}
        faq={CAFE_FAQ}
      />
    </div>
  );
}
