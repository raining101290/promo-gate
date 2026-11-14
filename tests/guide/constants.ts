/** Demo world for the guide screenshots (test DB only; see playwright.guide.config.ts). */
export const GUIDE = {
  port: 3301,
  baseURL: "http://localhost:3301",
  /** Address printed on the standee in the screenshots. */
  publicURL: process.env.GUIDE_PUBLIC_URL ?? "https://perks.cloudhosti.com",
  outbox: "./.outbox-guide.jsonl",
  upmindMockPort: 3398,
  upmindCalls: "./.outbox-guide-upmind.jsonl",
  outDir: "public/guide/shots",
  staffPassword: "guide-Staff-password-123",
  staff: {
    support: { email: "nadia@cafepass.demo", name: "Nadia Rahman" },
    finance: { email: "imran@cafepass.demo", name: "Imran Hossain" },
    admin: { email: "ayesha@cafepass.demo", name: "Ayesha Karim" },
  },
  partner: "Demo Bean House",
  branch: { code: "beanhouse-gulshan2", name: "Gulshan 2", pin: "4826" },
  customer: { invoice: "INV-204518", email: "tahmid.ahmed@example.com", phone: "01711234567" },
} as const;
