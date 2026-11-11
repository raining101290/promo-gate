/** Branch codes: lowercase a–z/0–9 words joined by single hyphens, 3–32 chars. Used in /r/<code>. */
export const BRANCH_CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const BRANCH_CODE_MAX = 32;

// Generic words that make partner slugs long without making them more recognisable.
const FILLER = /(?<![a-z])(the|and|coffee|cafe|roasters?|roastery|house|co|ltd|limited|bd)(?![a-z])/g;

function base(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (café -> cafe)
    .toLowerCase();
}

/** "Gulshan 2" -> "gulshan2"; "Road 11, Banani" -> "road11-banani". Non-Latin text yields "". */
export function slugify(input: string, maxLen = 20): string {
  const slug = base(input)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-(\d+)(?=-|$)/g, "$1"); // glue numbers to the previous word
  return truncateAtHyphen(slug, maxLen);
}

function truncateAtHyphen(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const i = cut.lastIndexOf("-");
  return (i >= 3 ? cut.slice(0, i) : cut).replace(/-+$/, "");
}

/** "Demo Bean House" + "Gulshan 2" -> "demo-bean-gulshan2" */
export function suggestBranchCode(partnerName: string, branchName: string): string {
  const partner = slugify(base(partnerName).replace(/&/g, " ").replace(FILLER, " "), 14) || slugify(partnerName, 14) || "partner";
  const branch = slugify(branchName, 16) || "branch";
  return truncateAtHyphen(`${partner}-${branch}`, BRANCH_CODE_MAX);
}

/** "demo-bean-gulshan2" + 2 -> "demo-bean-gulshan2-2", trimmed so the result still fits. */
export function withSuffix(code: string, n: number): string {
  const suffix = `-${n}`;
  return `${truncateAtHyphen(code, BRANCH_CODE_MAX - suffix.length)}${suffix}`;
}
