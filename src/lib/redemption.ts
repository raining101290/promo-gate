/** Short, human-readable reference for a redemption ("R-7F3K2Q"), for receipts and phone calls. */
export function redemptionRef(id: string): string {
  return `R-${id.slice(-6).toUpperCase()}`;
}

/** The success screen only shows "valid" (green) this long after redemption, so an old screenshot or
 *  a reopened page can't be passed off as a fresh confirmation. */
export const SUCCESS_FRESH_MS = 10 * 60 * 1000;

const BRANCH_PATH = /^\/r\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

/**
 * Extracts the branch code from a scanned standee QR (https://<any host>/r/<code>). We only ever
 * navigate within our own app using the code, so a QR pointing at another host can't send users off-site.
 */
export function parseBranchQr(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return BRANCH_PATH.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
