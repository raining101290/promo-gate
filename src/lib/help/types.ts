import type { StaffRole } from "@/generated/prisma/client";

/**
 * Staff knowledge base content model. Plain data (no JSX) so it stays easy to edit and search.
 * Inline text supports **bold** and `code` only (rendered by components/staff/help-text.tsx).
 */
export type HelpField = { name: string; why: string; tip?: string };
export type HelpRow = string[];

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "fields"; items: HelpField[] }
  | { kind: "table"; head: string[]; rows: HelpRow[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  /** A ready-to-send customer reply (copy button). */
  | { kind: "reply"; label: string; text: string };

export type HelpSection = { id: string; heading: string; blocks: HelpBlock[] };

export type HelpCategory = "Start here" | "Screens" | "Support playbook" | "Reference";

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  /** Roles this article is most useful for (everyone can read every article). */
  roles: readonly StaffRole[];
  /** Admin page this article explains, for the contextual "Help" link. */
  screen?: string;
  sections: HelpSection[];
};
