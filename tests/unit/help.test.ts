import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CAFE_GUIDE, CUSTOMER_GUIDE } from "@/lib/guide/content";
import { HELP_ARTICLES, helpSearchText } from "@/lib/help/articles";
import { computeDiscount, quoteRedemption } from "@/lib/money";
import type { OfferTerms } from "@/lib/offer";
import { redeemFailureMessage } from "@/lib/redeem-messages";
import { SUCCESS_FRESH_MS } from "@/lib/redemption";
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES } from "@/lib/schemas/receipt";
import { PASSWORD_MIN, REJECT_REASONS } from "@/lib/schemas/staff";
import { PERMISSIONS } from "@/server/auth/require-role";
import { SESSION_MAX_AGE_SECONDS, STAFF_SESSION_MAX_AGE_SECONDS } from "@/server/auth/token";
import { BULKSMSBD_CODES } from "@/server/providers/sms";
import { RATE_LIMITS } from "@/server/rate-limit";
import { FRAUD_RULES } from "@/server/services/fraud-signals";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/server/services/otp";
import { RECEIPT_GRACE_MS } from "@/server/services/redemption-review";
import { PIN_LOCK_MS } from "@/server/services/redemptions";
import { UPMIND_RETRY_MINUTES } from "@/server/services/upmind";
import { REMINDER_LEAD_MS } from "@/server/services/voucher-expiry";

const MIN = 60_000;
const HOUR = 60 * MIN;
const all = HELP_ARTICLES.map(helpSearchText).join(" ");
const has = (s: string) => expect(all.includes(s.toLowerCase()), `knowledge base should mention "${s}"`).toBe(true);

describe("knowledge base structure", () => {
  it("has unique slugs and section ids", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of HELP_ARTICLES) expect(new Set(a.sections.map((s) => s.id)).size, a.slug).toBe(a.sections.length);
  });

  it("links only to admin screens that exist", () => {
    for (const a of HELP_ARTICLES.filter((x) => x.screen)) {
      const dir = path.join("src/app/(staff)", a.screen!.replace(/^\//, ""));
      expect(existsSync(path.join(dir, "page.tsx")), a.screen).toBe(true);
    }
  });

  it("every <HelpLink slug> on a page points at a real article", () => {
    const root = "src/app/(staff)/admin";
    const slugs = new Set(HELP_ARTICLES.map((a) => a.slug));
    const pages = readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx"));
    const used = pages.flatMap((f) => [...readFileSync(path.join(root, f), "utf8").matchAll(/<HelpLink slug="([^"]+)"/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThanOrEqual(8);
    for (const s of used) expect(slugs.has(s), s).toBe(true);
  });
});

describe("guide screenshots", () => {
  it("every screenshot used by Help and the public guides exists (run `npm run guide:shots`)", () => {
    const fromHelp = HELP_ARTICLES.flatMap((a) => a.sections.flatMap((s) => s.blocks)).flatMap((b) => (b.kind === "walkthrough" ? b.steps : []));
    const fromGuides = [...CUSTOMER_GUIDE, ...CAFE_GUIDE].flatMap((p) => p.steps);
    const srcs = [...fromHelp, ...fromGuides].flatMap((st) => (st.shot ? [st.shot.src] : []));
    expect(srcs.length).toBeGreaterThan(20);
    for (const src of new Set(srcs)) expect(existsSync(path.join("public", src)), src).toBe(true);
  });
});

/** If one of these fails, the code changed: update the help article text, then the expected value here. */
describe("knowledge base matches the code", () => {
  it("login codes", () => {
    expect(OTP_TTL_MS).toBe(5 * MIN);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(RATE_LIMITS.otpRequestTarget).toEqual({ limit: 3, windowMs: 15 * MIN });
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 3600);
    has("valid for 5 minutes");
    has("3 codes per 15 min");
  });

  it("PINs, receipts, sessions and other limits", () => {
    expect(RATE_LIMITS.pinFailure).toEqual({ limit: 5, windowMs: 15 * MIN });
    expect(PIN_LOCK_MS).toBe(15 * MIN);
    expect(RATE_LIMITS.offerSubmitIp).toEqual({ limit: 5, windowMs: HOUR });
    expect(RATE_LIMITS.receiptUpload).toEqual({ limit: 10, windowMs: HOUR });
    expect(RATE_LIMITS.staffLogin).toEqual({ limit: 10, windowMs: 15 * MIN });
    expect(RATE_LIMITS.dataExport).toEqual({ limit: 5, windowMs: HOUR });
    expect(RECEIPT_MAX_BYTES).toBe(8 * 1024 * 1024);
    expect(Object.keys(RECEIPT_TYPES).sort()).toEqual(["image/heic", "image/heif", "image/jpeg", "image/png"]);
    expect(RECEIPT_GRACE_MS).toBe(24 * HOUR);
    expect(UPMIND_RETRY_MINUTES).toEqual([1, 5, 30, 120, 360, 720, 1440]);
    has("after 1, 5 and 30 minutes, then 2, 6, 12 and 24 hours");
    expect(REMINDER_LEAD_MS).toBe(3 * 24 * HOUR);
    expect(SUCCESS_FRESH_MS).toBe(10 * MIN);
    expect(STAFF_SESSION_MAX_AGE_SECONDS).toBe(12 * 3600);
    expect(PASSWORD_MIN).toBe(12);
    has("5 per 15 min, then 15 min lock");
    has("8 MB");
  });

  it("fraud badge rules", () => {
    expect(FRAUD_RULES).toMatchObject({
      repeatWindowMs: HOUR,
      billMultiple: 3,
      billMinSamples: 5,
      offHoursStart: 23,
      offHoursEnd: 7,
      pinFailureThreshold: 5,
    });
    expect(FRAUD_RULES.billLookbackMs).toBe(90 * 24 * HOUR);
    has("between 23:00 and 07:00");
  });

  it("every BulkSMSBD error code is explained in the SMS article", () => {
    const sms = helpSearchText(HELP_ARTICLES.find((a) => a.slug === "sms")!);
    const ranges = [...sms.matchAll(/(\d{4})–(\d{4})/g)].map((m) => [Number(m[1]), Number(m[2])]);
    for (const code of Object.keys(BULKSMSBD_CODES)) {
      const n = Number(code);
      expect(sms.includes(code) || ranges.some(([a, b]) => n >= a && n <= b), code).toBe(true);
    }
  });

  it("reject reasons are quoted exactly", () => {
    for (const label of Object.values(REJECT_REASONS)) has(label);
  });

  it("customer-facing redeem messages are quoted exactly", () => {
    has(redeemFailureMessage({ reason: "branch_unavailable" }));
    expect(redeemFailureMessage({ reason: "voucher_locked", retryAfterSeconds: 900 })).toMatch(/^Too many wrong PINs\. This voucher is locked for/);
    expect(redeemFailureMessage({ reason: "below_min_bill", minBill: 40000 })).toMatch(/^This voucher needs a bill of at least/);
  });

  it("the role table matches PERMISSIONS", () => {
    const staff = HELP_ARTICLES.find((a) => a.slug === "staff")!;
    const table = staff.sections.flatMap((s) => s.blocks).find((b) => b.kind === "table");
    if (table?.kind !== "table") throw new Error("staff permissions table missing");
    const row = (label: string) => table.rows.find((r) => r[0] === label)!.slice(1);
    const tick = (p: readonly string[]) => ["SUPPORT", "FINANCE", "ADMIN"].map((r) => (p.includes(r) ? "✓" : ""));
    expect(row("Review invoice requests")).toEqual(tick(PERMISSIONS.reviewRequests));
    expect(row("View redemptions")).toEqual(tick(PERMISSIONS.viewRedemptions));
    expect(row("Verify / dispute / reject redemptions")).toEqual(tick(PERMISSIONS.verifyRedemptions));
    expect(row("View partners & branches")).toEqual(tick(PERMISSIONS.viewPartners));
    expect(row("Create/edit partners, branches, PINs")).toEqual(tick(PERMISSIONS.managePartners));
    expect(row("Campaigns")).toEqual(tick(PERMISSIONS.manageCampaigns));
    expect(row("View settlements")).toEqual(tick(PERMISSIONS.viewSettlements));
    expect(row("Create, approve, pay settlements")).toEqual(tick(PERMISSIONS.manageSettlements));
    expect(row("SMS credit & delivery log")).toEqual(tick(PERMISSIONS.viewSms));
    expect(row("Email delivery log")).toEqual(tick(PERMISSIONS.viewEmail));
    expect(row("Upmind log")).toEqual(tick(PERMISSIONS.viewUpmind));
    expect(row("Send Upmind callbacks again")).toEqual(tick(PERMISSIONS.retryUpmind));
    expect(row("Audit log")).toEqual(tick(PERMISSIONS.viewAudit));
    expect(row("Manage staff")).toEqual(tick(PERMISSIONS.manageStaff));
  });

  it("the discount examples in the Campaigns article are what the app computes", () => {
    const fixed: OfferTerms = { offerType: "FIXED", value: 500_00, maxDiscount: null, minBill: null };
    const pct: OfferTerms = { offerType: "PERCENT", value: 1500, maxDiscount: 300_00, minBill: null };
    expect(computeDiscount(fixed, 850_00)).toBe(500_00);
    expect(computeDiscount(fixed, 320_00)).toBe(320_00);
    expect(computeDiscount(pct, 1200_00)).toBe(180_00);
    expect(computeDiscount(pct, 3000_00)).toBe(300_00);
    expect(quoteRedemption({ ...fixed, minBill: 400_00 }, 350_00)).toMatchObject({ ok: false, reason: "below_min_bill" });
  });
});
