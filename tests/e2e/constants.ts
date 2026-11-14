const port = Number(process.env.E2E_PORT ?? 3300);

export const E2E = {
  /** E2E_PORT overrides when 3300 is taken by something else. */
  port,
  baseURL: `http://localhost:${port}`,
  outbox: "./.outbox-e2e.jsonl",
  upmindMockPort: 3399,
  upmindCalls: "./.outbox-e2e-upmind.jsonl",
  staffPassword: "e2e-Staff-password-123",
  partnerName: "E2E Coffee House",
  branchCode: "e2e-gulshan",
  branchName: "Gulshan Avenue",
  pin: "1234",
  staff: { support: "support@e2e.test", finance: "finance@e2e.test", admin: "admin@e2e.test" },
} as const;
