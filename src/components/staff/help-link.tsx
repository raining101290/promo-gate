import Link from "next/link";

import { findHelpArticle } from "@/lib/help/articles";

/** Small "Help" link for a page header, pointing at the knowledge base article for that screen. */
export function HelpLink({ slug }: { slug: string }) {
  const a = findHelpArticle(slug);
  if (!a) return null;
  return (
    <Link
      href={`/admin/help/${a.slug}`}
      data-testid="help-link"
      title={`Help: ${a.title}`}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-muted"
    >
      <span aria-hidden className="grid size-4 place-items-center rounded-full border text-[10px] font-bold">
        ?
      </span>
      Help
    </Link>
  );
}
