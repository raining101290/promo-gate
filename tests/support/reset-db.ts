import { execSync } from "node:child_process";

import { TEST_DATABASE_URL } from "./test-env";

/** Drops and re-migrates the TEST database. Refuses anything that isn't clearly a test DB. */
export function resetTestDatabase() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset "${dbName}": test database names must end in _test`);
  execSync("npx prisma migrate reset --force", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: ["ignore", "ignore", "inherit"],
  });
}
