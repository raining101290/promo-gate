export const E2E = {
  port: 3300,
  baseURL: "http://localhost:3300",
  outbox: "./.outbox-e2e.jsonl",
  staffPassword: "e2e-Staff-password-123",
  partnerName: "E2E Coffee House",
  branchCode: "e2e-gulshan",
  branchName: "Gulshan Avenue",
  pin: "1234",
  staff: { support: "support@e2e.test", finance: "finance@e2e.test", admin: "admin@e2e.test" },
} as const;
