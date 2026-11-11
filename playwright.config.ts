import { defineConfig } from "@playwright/test";

import { E2E } from "./tests/e2e/constants";
import { TEST_ENV } from "./tests/support/test-env";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: E2E.baseURL,
    viewport: { width: 390, height: 844 },
    // Locally use the installed Google Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Dev server: the console/file message drivers (needed to read OTP codes) refuse to run in production.
    command: `npx next dev --turbopack -p ${E2E.port}`,
    url: `${E2E.baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { ...TEST_ENV, APP_URL: E2E.baseURL, OUTBOX_FILE: E2E.outbox, NEXT_DIST_DIR: ".next-e2e" },
  },
});
