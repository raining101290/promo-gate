"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

export type HelpIndexItem = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  forMe: boolean;
  text: string;
};

export function HelpIndex({ items, categories }: { items: HelpIndexItem[]; categories: string[] }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => items.filter((a) => words.every((w) => a.text.includes(w))), [items, words]);

  return (
    <div className="space-y-6">
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search: PIN locked, receipt, budget, four-eyes…"
        aria-label="Search help"
        data-testid="help-search"
        className="max-w-md"
      />
      {shown.length === 0 && <p className="text-muted-foreground text-sm">No articles match “{q}”. Try a shorter word.</p>}
      {categories.map((cat) => {
        const list = shown.filter((a) => a.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className="space-y-2">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{cat}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/admin/help/${a.slug}`}
                    data-testid={`help-article-${a.slug}`}
                    className="hover:bg-muted/50 block h-full rounded-lg border p-4 transition-colors"
                  >
                    <p className="flex items-center gap-2 font-medium">
                      {a.title}
                      {a.forMe && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                          For your role
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">{a.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
