/** Environment for unit tests and the E2E app server. Never points at the dev database. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://promo:promo@localhost:5435/promo_gate_test?schema=public";

export const TEST_ENV = {
  DATABASE_URL: TEST_DATABASE_URL,
  SESSION_SECRET: "test-session-secret-0123456789abcdef0123456789",
  CRON_SECRET: "test-cron-secret-0123456789",
  APP_URL: "http://localhost:3300",
  SMS_DRIVER: "file",
  EMAIL_DRIVER: "file",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: "./.storage-test",
};
