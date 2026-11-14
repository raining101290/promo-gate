import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { TEST_ENV } from "../support/test-env";
import { E2E } from "./constants";
import { readOtp, staffPage } from "./helpers";

test("Upmind paid invoice → login → redeem at 390px → Upmind told → receipt → verified → settlement paid", async ({ page, browser, request }) => {
  const run = Date.now().toString().slice(-8);
  const invoice = `E2E-${run}`;
  const email = `e2e-${run}@test.local`;
  const phoneLocal = `017${run}`;

  await test.step("Upmind pushes the paid invoice; the voucher is issued automatically", async () => {
    const validatedCode = createHmac("sha256", TEST_ENV.UPMIND_SECRET).update(`${invoice}:${email}`).digest("hex");
    const res = await request.post("/api/integrations/upmind/vouchers", {
      data: { customerName: "E2E Customer", email, phone: phoneLocal, invoiceNumber: invoice, validatedCode },
    });
    expect(res.status()).toBe(201);
    expect(await res.json()).toMatchObject({ status: "issued", invoiceNumber: invoice, voucher: { offer: "৳500 off" } });
    // The public invoice form is off.
    expect((await request.post("/api/offer-requests", { data: { invoiceNumber: "X-1", email, phone: phoneLocal } })).status()).toBe(410);
  });

  await test.step("customer logs in with the emailed code and sees the voucher", async () => {
    await page.goto("/");
    await expect(page.getByTestId("auto-cta")).toBeVisible();
    await page.goto("/login");
    await page.locator("#target").fill(email);
    const sentAfter = Date.now();
    await page.getByRole("button", { name: "Send code by email" }).click();
    await page.locator("#code").fill(await readOtp(email, sentAfter));
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("requests")).toContainText(invoice);
  });

  const support = await staffPage(browser, E2E.staff.support);
  await test.step("support sees it approved automatically", async () => {
    await support.goto(`/admin/requests?status=APPROVED&q=${invoice}`);
    await expect(support.getByRole("row", { name: new RegExp(invoice) })).toContainText("Automatic");
  });

  await test.step("customer redeems at the café: bill 1000 → PIN → success", async () => {
    await page.goto(`/r/${E2E.branchCode}`);
    await expect(page.getByTestId("branch-name")).toHaveText(E2E.partnerName);
    await page.getByTestId("voucher-option").first().click();
    await page.locator("#bill").fill("1000");
    await expect(page.getByTestId("calc")).toContainText("৳1,000");
    await expect(page.getByTestId("calc")).toContainText("৳500");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByTestId("cashier-summary")).toContainText(E2E.branchName);
    for (const d of E2E.pin) await page.getByRole("button", { name: d, exact: true }).click();
    await expect(page.getByTestId("success")).toHaveAttribute("data-fresh", "true");
    await expect(page.getByTestId("cashier-instruction")).toHaveText(/record 500 BDT as payment type “Hosting\.com Voucher”/);
    // No horizontal scrolling at 390px.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  await test.step("Upmind is told the voucher was redeemed", async () => {
    await expect
      .poll(() => (existsSync(E2E.upmindCalls) ? readFileSync(E2E.upmindCalls, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []), { timeout: 15_000 })
      .toEqual([
        expect.objectContaining({
          event: "voucher.redeemed",
          invoiceNumber: invoice,
          redemption: expect.objectContaining({ branchCode: E2E.branchCode, billAmount: "1000.00", discountAmount: "500.00", customerPaid: "500.00", currency: "BDT" }),
        }),
      ]);
  });

  await test.step("customer uploads the receipt photo", async () => {
    await page.getByTestId("upload-receipt-now").click();
    await page.getByTestId("receipt-input").setInputFiles("tests/e2e/fixtures/receipt.jpg");
    await expect(page.getByTestId("prepared-info")).toContainText("Resized to 1200×1600");
    await page.locator("#pos").fill("004512");
    await page.getByTestId("upload").click();
    await expect(page.getByTestId("upload-done")).toBeVisible();
  });

  await test.step("support verifies the redemption against the receipt", async () => {
    await support.goto("/admin/redemptions?tab=review");
    await support
      .getByRole("row", { name: new RegExp(email) })
      .getByRole("link", { name: "Review" })
      .click();
    await expect(support.getByTestId("receipt-image")).toBeVisible();
    await support.getByTestId("verify").click();
    await expect(support.getByText("Verified by")).toBeVisible();
  });

  const finance = await staffPage(browser, E2E.staff.finance);
  await test.step("finance drafts the settlement (৳500), admin approves, finance marks it paid", async () => {
    await finance.goto("/admin/settlements");
    await finance
      .getByRole("row", { name: new RegExp(E2E.partnerName) })
      .getByTestId("create-draft")
      .click();
    await expect(finance).toHaveURL(/\/admin\/settlements\/[a-z0-9]+$/);
    await expect(finance.getByTestId("settlement-total")).toHaveText("৳500");
    await expect(finance.getByTestId("four-eyes")).toBeVisible(); // creator can't approve
    const settlementUrl = finance.url();

    const admin = await staffPage(browser, E2E.staff.admin);
    admin.on("dialog", (d) => d.accept());
    await admin.goto(settlementUrl);
    await admin.getByTestId("approve").click();
    await expect(admin.getByTestId("mark-paid")).toBeVisible();

    finance.on("dialog", (d) => d.accept());
    await finance.reload();
    await finance.locator("#ref").fill("BKX9F2K7QW");
    await finance.getByTestId("mark-paid").click();
    await expect(finance.getByText("Paid. This settlement is closed")).toBeVisible();
    await expect(finance.getByText("BKX9F2K7QW")).toBeVisible();
  });
});
