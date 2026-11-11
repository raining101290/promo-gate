import { HELP_ARTICLES, HELP_CATEGORIES, helpSearchText } from "@/lib/help/articles";
import { requireStaffPage } from "@/server/auth/require-role";

import { HelpIndex, type HelpIndexItem } from "./help-index";

export const metadata = { title: "Help" };

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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help & knowledge base</h1>
        <p className="text-muted-foreground text-sm">
          What every screen and field is for, how the programme works, and what to tell customers. Start with “How Hosting.com Perks works” if you are
          new.
        </p>
      </div>
      <HelpIndex items={items} categories={[...HELP_CATEGORIES]} />
    </div>
  );
}
