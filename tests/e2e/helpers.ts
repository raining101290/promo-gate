import { existsSync, readFileSync } from "node:fs";

import { expect, type Browser, type Page } from "@playwright/test";

import { E2E } from "./constants";

/** Latest 6-digit login code sent to `to` (E.164 phone or email), from the file outbox. */
export async function readOtp(to: string, after: number): Promise<string> {
  for (let i = 0; i < 60; i++) {
    if (existsSync(E2E.outbox)) {
      const hit = readFileSync(E2E.outbox, "utf8")
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
  throw new Error(`No OTP for ${to}`);
}

/** A desktop staff session in its own browser context. */
export async function staffPage(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(E2E.staffPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/);
  return page;
}
