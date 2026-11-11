import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { TEST_ENV } from "./tests/support/test-env.ts";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server Components build; services are plain Node here.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: TEST_ENV,
    globalSetup: ["tests/support/global-setup.ts"],
    // One shared test DB: run files one at a time (tests inside a file still use unique fixtures).
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
