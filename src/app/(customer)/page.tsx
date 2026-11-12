import Link from "next/link";

import { SiteHeader } from "@/components/customer/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerSession } from "@/server/auth/customer";
import { enabledOtpChannels } from "@/server/otp-channels";

import { SubmitForm } from "./submit-form";

const STEPS = [
  { title: "Submit your invoice", body: "Enter the number of a paid hosting.com invoice with your email and mobile." },
  { title: "We verify it", body: "Our support team checks the invoice, usually within one working day." },
  { title: "Enjoy your coffee", body: "Show your voucher at a partner café. Scan the counter QR, and the cashier confirms." },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const loggedIn = !!(await getCustomerSession());
  const { deleted } = await searchParams;

  return (
    <div className="min-h-dvh">
      <SiteHeader loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-md px-4 pt-6 pb-12">
        {deleted === "1" && (
          <p className="bg-muted mb-5 rounded-lg p-3 text-sm" role="status" data-testid="deleted-notice">
            Your account has been deleted and you&apos;ve been logged out.
          </p>
        )}
        <section>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">Coffee&apos;s on us.</h1>
          <p className="text-muted-foreground mt-2">Paid for hosting.com? Get a voucher for partner coffee shops across Bangladesh.</p>
        </section>

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{step.title}</p>
                <p className="text-muted-foreground text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm">
          <Link href="/guide" className="font-medium underline underline-offset-4">
            See every step with screenshots
          </Link>
        </p>

        <Card className="mt-8" id="submit">
          <CardHeader>
            <CardTitle>Claim your voucher</CardTitle>
            <CardDescription>One voucher per paid invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <SubmitForm channels={enabledOtpChannels()} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already submitted?{" "}
          <Link href={loggedIn ? "/dashboard" : "/login"} className="text-foreground font-medium underline underline-offset-4">
            {loggedIn ? "See your vouchers" : "Log in to see your vouchers"}
          </Link>
        </p>
      </main>
    </div>
  );
}
