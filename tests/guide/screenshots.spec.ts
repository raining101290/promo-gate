import { existsSync, mkdirSync, readFileSync } from "node:fs";

import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { GUIDE } from "./constants";

/**
 * Walks the programme once, end to end, and saves the screenshots for /guide and /admin/help.
 * File names are referenced from src/lib/guide/content.ts and src/lib/help/articles.ts.
 */

const HIDE_DEV_UI = "nextjs-portal{display:none!important} *{caret-color:transparent!important}";

async function shot(page: Page, name: string, target?: Locator) {
  mkdirSync(GUIDE.outDir, { recursive: true });
  await page.addStyleTag({ content: HIDE_DEV_UI });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400); // let toasts/dialogs finish animating
  const path = `${GUIDE.outDir}/${name}.jpg`;
  if (target) await target.screenshot({ path, type: "jpeg", quality: 82 });
  else await page.screenshot({ path, type: "jpeg", quality: 78 });
}

/** Latest login code sent to `to`, from this run's file outbox. */
async function readOtp(to: string, after: number): Promise<string> {
  for (let i = 0; i < 60; i++) {
    if (existsSync(GUIDE.outbox)) {
      const hit = readFileSync(GUIDE.outbox, "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as { to: string; body: string; at: string })
        .filter((m) => m.to === to && Date.parse(m.at) >= after)
        .map((m) => /login code is (\d{6})/.exec(m.body)?.[1])
        .filter(Boolean)
        .at(-1);
      if (hit) return hit;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No login code for ${to}`);
}

async function phone(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  return ctx.newPage();
}

async function desk(browser: Browser, who: keyof typeof GUIDE.staff): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto("/admin/login");
  await page.locator("#email").fill(GUIDE.staff[who].email);
  await page.locator("#password").fill(GUIDE.staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
  return page;
}

test("guide screenshots", async ({ browser }) => {
  const c = GUIDE.customer;
  const me = await phone(browser);
  const support = await desk(browser, "support");
  const finance = await desk(browser, "finance");
  const admin = await desk(browser, "admin");

  await test.step("customer: claim, log in, wait", async () => {
    await me.goto("/");
    await shot(me, "customer-home");
    await me.locator("#invoiceNumber").fill(c.invoice);
    await me.locator("#email").fill(c.email);
    await me.locator("#phone").fill(c.phone);
    await me.locator("#submit").scrollIntoViewIfNeeded();
    await me.evaluate(() => document.getElementById("submit")?.scrollIntoView({ block: "start" }));
    await shot(me, "customer-claim");
    const sentAfter = Date.now();
    await me.getByRole("button", { name: "Submit invoice" }).click();
    await expect(me.getByRole("status")).toContainText("Invoice received");
    await me.locator("#code").fill(await readOtp(c.email, sentAfter));
    await shot(me, "customer-code");
    await me.getByRole("button", { name: "Verify and continue" }).click();
    await expect(me).toHaveURL(/\/dashboard$/);
    await expect(me.getByTestId("requests")).toContainText("Pending");
    await shot(me, "customer-pending");
  });

  await test.step("support: approve the request", async () => {
    await support.goto("/admin/requests?status=PENDING");
    await expect(support.getByText(c.invoice)).toBeVisible();
    await shot(support, "staff-requests");
    await support.getByRole("row", { name: new RegExp(c.invoice) }).getByRole("link", { name: "Review" }).click();
    await expect(support.getByTestId("approve")).toBeVisible();
    await shot(support, "staff-request-review");
    await support.getByTestId("approve").click();
    await expect(support.getByText("Review outcome")).toBeVisible();
    await shot(support, "staff-request-approved");
  });

  await test.step("customer: voucher, redeem at the café, receipt", async () => {
    await me.goto("/dashboard");
    await shot(me, "customer-voucher");
    await me.locator("a[href^=\"/dashboard/vouchers/\"]").first().click();
    await expect(me.getByTestId("redeem-button")).toBeVisible();
    await shot(me, "customer-voucher-detail");

    await me.goto(`/r/${GUIDE.branch.code}`);
    await expect(me.getByTestId("branch-name")).toHaveText(GUIDE.partner);
    await shot(me, "customer-scan");
    await me.getByTestId("voucher-option").first().click();
    await me.locator("#bill").fill("1000");
    await expect(me.getByTestId("calc")).toContainText("৳500");
    await shot(me, "customer-bill");
    await me.getByRole("button", { name: "Continue" }).click();
    await expect(me.getByTestId("cashier-summary")).toContainText(GUIDE.branch.name);
    await shot(me, "customer-pin");
    for (const d of GUIDE.branch.pin) await me.getByRole("button", { name: d, exact: true }).click();
    await expect(me.getByTestId("success")).toHaveAttribute("data-fresh", "true");
    await me.waitForTimeout(1500); // let the tick animation finish
    await shot(me, "customer-success");

    await me.getByTestId("upload-receipt-now").click();
    await me.getByTestId("receipt-input").setInputFiles("tests/e2e/fixtures/receipt.jpg");
    await expect(me.getByTestId("prepared-info")).toBeVisible();
    await me.locator("#pos").fill("004512");
    await shot(me, "customer-receipt");
    await me.getByTestId("upload").click();
    await expect(me.getByTestId("upload-done")).toBeVisible();
    await shot(me, "customer-receipt-done");
  });

  await test.step("support: check the receipt", async () => {
    await support.goto("/admin/redemptions?tab=review");
    await expect(support.getByRole("row", { name: new RegExp(c.email.slice(0, 4)) }).first()).toBeVisible();
    await shot(support, "staff-redemptions");
    await support.getByRole("row", { name: /Gulshan 2/ }).filter({ hasText: "৳1,000" }).getByRole("link", { name: "Review" }).click();
    await expect(support.getByTestId("receipt-image")).toBeVisible();
    await shot(support, "staff-redemption-review");
    await support.getByTestId("verify").click();
    await expect(support.getByText("Verified by")).toBeVisible();
  });

  await test.step("customer: verified", async () => {
    await me.reload();
    await shot(me, "customer-verified");
  });

  await test.step("finance + admin: pay the café", async () => {
    await finance.goto("/admin/settlements");
    await shot(finance, "staff-settlements");
    await finance.getByRole("row", { name: new RegExp(GUIDE.partner) }).getByTestId("create-draft").click();
    await expect(finance).toHaveURL(/\/admin\/settlements\/[a-z0-9]+$/);
    await expect(finance.getByTestId("four-eyes")).toBeVisible();
    await shot(finance, "staff-settlement-draft");
    const url = finance.url();
    await admin.goto(url);
    await admin.getByTestId("approve").click();
    await expect(admin.getByTestId("mark-paid")).toBeVisible();
    await finance.reload();
    await finance.locator("#ref").fill("BKX9F2K7QW");
    await shot(finance, "staff-settlement-approved");
    await finance.getByTestId("mark-paid").click();
    await expect(finance.getByText("Paid. This settlement is closed")).toBeVisible();
    await shot(finance, "staff-settlement-paid");
  });

  await test.step("admin: cafés, branches, PINs, standee", async () => {
    await admin.goto("/admin/partners");
    await shot(admin, "staff-partners");
    await admin.getByRole("row", { name: new RegExp(GUIDE.partner) }).getByRole("link", { name: "Manage" }).click();
    await expect(admin.getByRole("heading", { name: GUIDE.partner })).toBeVisible();
    await shot(admin, "staff-partner");
    const partnerUrl = admin.url();

    await admin.goto(`${partnerUrl}/branches/new`);
    await admin.locator("#name").fill("Uttara Sector 7");
    await admin.locator("#area").fill("Uttara");
    await admin.locator("#address").fill("Road 15, Sector 7, Uttara, Dhaka");
    await admin.locator("#smsPhone").fill("01711000004");
    await shot(admin, "staff-branch-form");
    await admin.getByRole("button", { name: "Create branch" }).click();
    await expect(admin.getByTestId("pin")).toBeVisible();
    await shot(admin, "staff-branch-pin");

    await admin.goto(partnerUrl);
    await admin.getByRole("row", { name: new RegExp(GUIDE.branch.name) }).getByRole("link", { name: "Standee" }).click();
    await expect(admin.getByTestId("standee-qr")).toBeVisible();
    await shot(admin, "cafe-standee", admin.getByTestId("standee"));
    await admin.goto(`${partnerUrl}/cashier-guide`);
    await shot(admin, "cafe-cashier-guide", admin.getByTestId("cashier-guide"));
  });

  await test.step("admin: campaigns, staff, logs", async () => {
    await admin.goto("/admin/campaigns");
    await shot(admin, "staff-campaigns");
    await admin.goto("/admin/campaigns/new");
    await shot(admin, "staff-campaign-form");
    await admin.goto("/admin/staff");
    await shot(admin, "staff-staff");
    await admin.getByTestId("add-staff").click();
    await admin.locator("#staff-name").fill("Karim Chowdhury");
    await admin.locator("#staff-email").fill("karim@cafepass.demo");
    await shot(admin, "staff-add-staff");
    await admin.keyboard.press("Escape");
    await admin.goto("/admin/audit");
    await shot(admin, "staff-audit");
    await admin.goto("/admin/emails");
    await shot(admin, "staff-emails");
    await admin.goto("/admin");
    await shot(admin, "staff-home");
  });
});
