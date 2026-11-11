import Link from "next/link";
import { notFound } from "next/navigation";

import { HelpBlocks } from "@/components/staff/help-blocks";
import { HELP_ARTICLES, findHelpArticle } from "@/lib/help/articles";
import { requireStaffPage } from "@/server/auth/require-role";

const ROLE_LABEL = {
  SUPPORT: "Support",
  FINANCE: "Finance",
  ADMIN: "Admin",
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = findHelpArticle((await params).slug);
  return { title: a ? `${a.title} · Help` : "Help" };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireStaffPage(undefined, `/admin/help/${slug}`);
  const a = findHelpArticle(slug);
  if (!a) notFound();

  const i = HELP_ARTICLES.indexOf(a);
  const prev = HELP_ARTICLES[i - 1];
  const next = HELP_ARTICLES[i + 1];

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_13rem]">
      <article className="min-w-0 space-y-8">
        <header className="space-y-2">
          <Link href="/admin/help" className="text-muted-foreground hover:text-foreground text-sm">
            ← Help
          </Link>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{a.category}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
          <p className="text-muted-foreground">{a.summary}</p>
          <p className="text-muted-foreground text-xs">Most useful for: {a.roles.map((r) => ROLE_LABEL[r]).join(", ")}</p>
          {a.screen && (
            <p className="text-sm">
              <Link href={a.screen} className="underline underline-offset-4">
                Open this screen →
              </Link>
            </p>
          )}
        </header>

        {a.sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6 space-y-3">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <HelpBlocks blocks={s.blocks} />
          </section>
        ))}

        <nav className="flex justify-between gap-4 border-t pt-4 text-sm" aria-label="More articles">
          {prev ? (
            <Link href={`/admin/help/${prev.slug}`} className="hover:underline">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/admin/help/${next.slug}`} className="text-right hover:underline">
              {next.title} →
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-2 text-sm">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">On this page</p>
          <ul className="space-y-1">
            {a.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
