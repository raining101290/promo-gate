import Link from "next/link";

import { HelpText } from "@/components/staff/help-text";
import type { GuidePart, GuideQA } from "@/lib/guide/content";
import { cn } from "@/lib/utils";

import { Walkthrough } from "./walkthrough";

type Audience = "customers" | "cafes";

const TABS: { id: Audience; href: string; label: string }[] = [
  { id: "customers", href: "/guide", label: "For customers" },
  { id: "cafes", href: "/guide/cafes", label: "For cafés" },
];

/** Public, pre-login guide: tabs, a short contents list, numbered steps with screenshots, then FAQs. */
export function GuidePage({
  audience,
  title,
  lead,
  parts,
  faq,
  cta,
}: {
  audience: Audience;
  title: string;
  lead: string;
  parts: GuidePart[];
  faq: GuideQA[];
  cta?: { href: string; label: string };
}) {
  let n = 1;
  const numbered = parts.map((p) => {
    const startAt = n;
    n += p.steps.length;
    return { ...p, startAt };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16">
      <nav aria-label="Guide" className="bg-muted inline-flex rounded-lg p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={t.id === audience ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              t.id === audience ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <header className="mt-6 space-y-2">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground max-w-prose">{lead}</p>
      </header>

      <ol className="mt-6 grid gap-2 sm:grid-cols-3" aria-label="Contents">
        {numbered.map((p, i) => (
          <li key={p.id}>
            <a href={`#${p.id}`} className="hover:bg-muted/60 flex h-full items-baseline gap-2 rounded-lg border p-3 text-sm transition-colors">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="font-medium">{p.heading}</span>
            </a>
          </li>
        ))}
      </ol>

      <div className="mt-12 space-y-16">
        {numbered.map((p) => (
          <section key={p.id} id={p.id} aria-labelledby={`${p.id}-h`} className="scroll-mt-6 space-y-6">
            <div className="space-y-1 border-b pb-3">
              <h2 id={`${p.id}-h`} className="text-xl font-semibold tracking-tight">
                {p.heading}
              </h2>
              {p.intro && <p className="text-muted-foreground">{p.intro}</p>}
            </div>
            <Walkthrough steps={p.steps} startAt={p.startAt} />
          </section>
        ))}

        <section id="questions" aria-labelledby="questions-h" className="scroll-mt-6 space-y-4">
          <h2 id="questions-h" className="border-b pb-3 text-xl font-semibold tracking-tight">
            Questions
          </h2>
          <div className="divide-y rounded-lg border">
            {faq.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                  <HelpText text={f.a} />
                </p>
              </details>
            ))}
          </div>
        </section>

        {cta && (
          <div className="bg-muted flex flex-col items-start gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">Ready to start?</p>
            <Link href={cta.href} className="bg-primary text-primary-foreground rounded-md px-4 py-2.5 text-sm font-medium">
              {cta.label}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
