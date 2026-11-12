import type { StaffRole } from "@/generated/prisma/client";

/**
 * Staff knowledge base content model. Plain data (no JSX) so it stays easy to edit and search.
 * Inline text supports **bold** and `code` only (rendered by components/staff/help-text.tsx).
 */
export type HelpField = { name: string; why: string; tip?: string };

/** A screenshot in public/guide/shots (made by `npm run guide:shots`). */
export type GuideShot = { src: string; alt: string; device: "phone" | "desktop" | "print"; w?: number; h?: number };
/** One step of a walkthrough: what to do, why, and what the screen looks like. */
export type GuideStep = { title: string; text: string; tip?: string; shot?: GuideShot };
export type HelpRow = string[];

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "fields"; items: HelpField[] }
  | { kind: "table"; head: string[]; rows: HelpRow[] }
  | { kind: "note"; tone: "info" | "warn"; text: string }
  /** A ready-to-send customer reply (copy button). */
  | { kind: "reply"; label: string; text: string }
  /** Numbered steps, each with its screenshot. */
  | { kind: "walkthrough"; steps: GuideStep[] };

export type HelpSection = { id: string; heading: string; blocks: HelpBlock[] };

export type HelpCategory = "Start here" | "Workflows" | "Customer support" | "Reference";

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
