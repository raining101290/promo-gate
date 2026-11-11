import { expect, test } from "@playwright/test";

import { E2E } from "./constants";
import { readOtp, staffPage } from "./helpers";

test("invoice → approval → redeem at 390px → receipt → verified → settlement paid", async ({ page, browser }) => {
  const run = Date.now().toString().slice(-8);
  const invoice = `E2E-${run}`;
  const email = `e2e-${run}@test.local`;
  const phoneLocal = `017${run}`;

  await test.step("customer submits an invoice and logs in with the emailed code", async () => {
    await page.goto("/");
    await page.locator("#invoiceNumber").fill(invoice.toLowerCase());
    await page.locator("#email").fill(email);
    await page.locator("#phone").fill(phoneLocal);
    const sentAfter = Date.now();
    await page.getByRole("button", { name: "Submit invoice" }).click();
    await expect(page.getByRole("status")).toContainText("Invoice received");
    await page.locator("#code").fill(await readOtp(email, sentAfter));
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("requests")).toContainText(invoice);
    await expect(page.getByTestId("requests")).toContainText("Pending");
  });

  const support = await staffPage(browser, E2E.staff.support);
  await test.step("support approves the request", async () => {
    await support.goto(`/admin/requests?status=PENDING&q=${invoice}`);
    await support.getByRole("link", { name: "Review" }).click();
    await support.getByTestId("approve").click();
    await expect(support.getByText("Review outcome")).toBeVisible();
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
