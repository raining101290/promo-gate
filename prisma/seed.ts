// Dev seed. Idempotent: safe to re-run. Staff passwords are regenerated and printed on each run.
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient, type StaffRole } from "../src/generated/prisma/client";
import { snapshotTerms } from "../src/lib/offer";

if (process.env.NODE_ENV === "production") {
  throw new Error("prisma/seed.ts creates DEMO data and is dev-only. For production use: npm run db:seed-admin");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const BRANCH_PIN = "1234";

const STAFF: { email: string; name: string; role: StaffRole }[] = [
  { email: "admin@perks.local", name: "Admin User", role: "ADMIN" },
  { email: "support@perks.local", name: "Support User", role: "SUPPORT" },
  { email: "finance@perks.local", name: "Finance User", role: "FINANCE" },
];

const PARTNERS = [
  {
    id: "seed_partner_bean",
    name: "Demo Bean House",
    contactName: "Rahim Uddin",
    contactPhone: "+8801700000001",
    payoutMethod: "BANK" as const,
    payoutAccount: "Demo Bank 0011223344",
    branches: [
      { branchCode: "bean-gulshan", name: "Gulshan 2", area: "Gulshan", address: "Road 90, Gulshan 2, Dhaka", smsPhone: "+8801700000011" },
      { branchCode: "bean-dhanmondi", name: "Dhanmondi 27", area: "Dhanmondi", address: "Road 27, Dhanmondi, Dhaka", smsPhone: "+8801700000012" },
    ],
  },
  {
    id: "seed_partner_brew",
    name: "Sample Brew Co.",
    contactName: "Nusrat Jahan",
    contactPhone: "+8801700000002",
    payoutMethod: "BKASH" as const,
    payoutAccount: "+8801700000002",
    branches: [
      { branchCode: "brew-banani", name: "Banani 11", area: "Banani", address: "Road 11, Banani, Dhaka", smsPhone: "+8801700000021" },
      { branchCode: "brew-uttara", name: "Uttara Sector 7", area: "Uttara", address: "Sector 7, Uttara, Dhaka", smsPhone: "+8801700000022" },
    ],
  },
];

async function main() {
  // Staff
  const credentials: { email: string; role: StaffRole; password: string }[] = [];
  for (const s of STAFF) {
    const password = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.staffUser.upsert({
      where: { email: s.email },
      update: { passwordHash, name: s.name, role: s.role, active: true },
      create: { ...s, passwordHash },
    });
    credentials.push({ email: s.email, role: s.role, password });
  }

  // Campaign: 500 BDT fixed, 30-day vouchers
  const campaignName = "Launch Offer - 500 BDT";
  const campaign =
    (await prisma.campaign.findFirst({ where: { name: campaignName } })) ??
    (await prisma.campaign.create({
      data: {
        name: campaignName,
        offerType: "FIXED",
        value: 500_00, // paisa
        validityDays: 30,
        startsAt: new Date(),
        active: true,
      },
    }));

  // Partners + branches
  const pinHash = await bcrypt.hash(BRANCH_PIN, 10);
  for (const { branches, ...partner } of PARTNERS) {
    await prisma.partner.upsert({
      where: { id: partner.id },
      update: {},
      create: { ...partner, contractStatus: "ACTIVE" },
    });
    for (const b of branches) {
      await prisma.branch.upsert({
        where: { branchCode: b.branchCode },
        update: { pinHash },
        create: { ...b, partnerId: partner.id, pinHash },
      });
    }
  }

  // Customer
  const customer = await prisma.customer.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: { email: "customer@example.com", phone: "+8801711000000", name: "Test Customer" },
  });

  // Demo history for the seeded customer so every dashboard state renders. Inserted directly
  // (seed only); real vouchers are issued through the voucher service.
  const percentCampaign =
    (await prisma.campaign.findFirst({ where: { name: "Weekend 20% (demo)" } })) ??
    (await prisma.campaign.create({
      data: {
        name: "Weekend 20% (demo)",
        offerType: "PERCENT",
        value: 2000, // basis points = 20%
        maxDiscount: 300_00,
        minBill: 500_00,
        validityDays: 14,
        startsAt: new Date(),
        active: false, // keeps "1 active campaign"; only used for demo vouchers
      },
    }));
  const support = await prisma.staffUser.findUniqueOrThrow({ where: { email: "support@perks.local" } });
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const demo = [
    { invoice: "SEED-INV-1001", campaignId: campaign.id, voucher: { status: "ACTIVE", expiresInMs: 30 * day } },
    { invoice: "SEED-INV-1002", campaignId: percentCampaign.id, voucher: { status: "ACTIVE", expiresInMs: 3 * day } },
    { invoice: "SEED-INV-1003", campaignId: campaign.id, voucher: { status: "REDEEMED", expiresInMs: 20 * day } },
    { invoice: "SEED-INV-1004", campaignId: campaign.id, voucher: { status: "EXPIRED", expiresInMs: -2 * day } },
    { invoice: "SEED-INV-1005", campaignId: campaign.id, rejectReason: "Invoice is not paid yet" },
  ] as const;
  const gulshan = await prisma.branch.findUniqueOrThrow({ where: { branchCode: "bean-gulshan" } });

  for (const d of demo) {
    const approved = "voucher" in d;
    const request = await prisma.offerRequest.upsert({
      where: { invoiceNumber: d.invoice },
      update: {},
      create: {
        customerId: customer.id,
        invoiceNumber: d.invoice,
        submittedEmail: customer.email,
        submittedPhone: customer.phone,
        status: approved ? "APPROVED" : "REJECTED",
        rejectReason: approved ? null : d.rejectReason,
        reviewedById: support.id,
        reviewedAt: new Date(now - 5 * day),
      },
    });
    if (!approved) continue;
    const voucher = await prisma.voucher.upsert({
      where: { offerRequestId: request.id },
      update: {},
      create: {
        offerRequestId: request.id,
        campaignId: d.campaignId,
        customerId: customer.id,
        code: randomBytes(18).toString("base64url"), // 24 chars
        status: d.voucher.status,
        issuedAt: new Date(now - 5 * day),
        expiresAt: new Date(now + d.voucher.expiresInMs),
        ...snapshotTerms(d.campaignId === campaign.id ? campaign : percentCampaign),
      },
    });
    if (d.voucher.status === "REDEEMED") {
      await prisma.redemption.upsert({
        where: { voucherId: voucher.id },
        update: {},
        create: {
          voucherId: voucher.id,
          branchId: gulshan.id,
          customerId: customer.id,
          billAmount: 1_200_00,
          discountAmount: 500_00,
          customerPaid: 700_00,
          status: "CLAIMED",
          redeemedAt: new Date(now - 1 * day),
        },
      });
    }
  }

  console.log("\nSeed complete.\n");
  console.log("Staff logins (passwords regenerate on every seed run):");
  console.table(credentials);
  console.log(`Campaign: ${campaign.name} (${campaign.offerType} ${campaign.value / 100} BDT, ${campaign.validityDays} days)`);
  console.log(`Branch PIN for all seeded branches: ${BRANCH_PIN}`);
  console.table(PARTNERS.flatMap((p) => p.branches.map((b) => ({ partner: p.name, branch: b.name, url: `/r/${b.branchCode}` }))));
  console.log(`Customer: ${customer.email} / ${customer.phone}`);
  console.log(`Demo history for customer: ${demo.map((d) => d.invoice).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
