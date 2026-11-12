import { defineConfig } from "@playwright/test";

import { GUIDE } from "./tests/guide/constants";
import { TEST_ENV } from "./tests/support/test-env";

/**
 * `npm run guide:shots`: walks the whole programme on the TEST database with demo data and saves the
 * screenshots used by /guide and /admin/help into public/guide/shots. Resets the test DB.
 */
export default defineConfig({
  testDir: "tests/guide",
  timeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/guide/global-setup.ts",
  use: {
    baseURL: GUIDE.baseURL,
    channel: process.env.CI ? undefined : "chrome",
    colorScheme: "light",
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
  },
  webServer: {
    command: `npx next dev --turbopack -p ${GUIDE.port}`,
    url: `${GUIDE.baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    // APP_URL only feeds printed links (standee QR) and email links here; dev redirects use the request URL.
    env: { ...TEST_ENV, APP_URL: GUIDE.publicURL, OUTBOX_FILE: GUIDE.outbox, NEXT_DIST_DIR: ".next-guide" },
  },
});
