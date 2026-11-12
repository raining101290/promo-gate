import Link from "next/link";

import { HELP_ARTICLES, HELP_CATEGORIES, helpSearchText } from "@/lib/help/articles";
import { requireStaffPage } from "@/server/auth/require-role";

import { HelpIndex, type HelpIndexItem } from "./help-index";

export const metadata = { title: "Help" };

/** The voucher's life, left to right: who acts at each stage and which article explains it. */
const FLOW = [
  { slug: "requests", who: "Support", title: "Approve the request", body: "Invoice checked, voucher issued" },
  { slug: "playbook-voucher", who: "Customer + café", title: "Redeem at the café", body: "QR scan, bill, branch PIN" },
  { slug: "redemptions", who: "Support", title: "Check the receipt", body: "Verify, dispute or reject" },
  { slug: "settlements", who: "Finance", title: "Pay the café", body: "Draft, approve, mark paid" },
] as const;

const SETUP = [
  { slug: "campaigns", title: "Set up a campaign" },
  { slug: "partners-branches", title: "Add a café and its branches" },
  { slug: "staff", title: "Add and manage staff" },
] as const;

export default async function HelpPage() {
  const staff = await requireStaffPage(undefined, "/admin/help");
  const items: HelpIndexItem[] = HELP_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    category: a.category,
    forMe: a.roles.includes(staff.role),
    text: helpSearchText(a),
  }));

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="text-muted-foreground text-sm">
          Step-by-step guides with screenshots for every job in this admin. New here? Start with{" "}
          <Link href="/admin/help/how-it-works" className="text-foreground font-medium underline underline-offset-4">
            How the Coffee Campaign works
          </Link>
          .
        </p>
      </div>

      <section aria-labelledby="flow-h" className="space-y-3">
        <h2 id="flow-h" className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          A voucher&apos;s life
        </h2>
        <ol className="grid gap-2 sm:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.slug} className="relative">
              <Link
                href={`/admin/help/${f.slug}`}
                data-testid={`help-flow-${f.slug}`}
                className="hover:bg-muted/50 flex h-full flex-col gap-1 rounded-lg border p-3 transition-colors"
              >
                <span className="text-muted-foreground text-xs tabular-nums">
                  {i + 1} · {f.who}
                </span>
                <span className="font-medium">{f.title}</span>
                <span className="text-muted-foreground text-xs">{f.body}</span>
              </Link>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="text-muted-foreground absolute top-1/2 -right-2 z-10 hidden -translate-y-1/2 text-sm sm:block">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>Admin setup:</span>
          {SETUP.map((s) => (
            <Link key={s.slug} href={`/admin/help/${s.slug}`} className="text-foreground underline underline-offset-4">
              {s.title}
            </Link>
          ))}
        </p>
        <p className="text-muted-foreground text-sm">
          Public guides you can send:{" "}
          <Link href="/guide" target="_blank" className="text-foreground underline underline-offset-4">
            for customers
          </Link>{" "}
          ·{" "}
          <Link href="/guide/cafes" target="_blank" className="text-foreground underline underline-offset-4">
            for cafés
          </Link>
        </p>
      </section>

      <HelpIndex items={items} categories={[...HELP_CATEGORIES]} />
    </div>
  );
}
