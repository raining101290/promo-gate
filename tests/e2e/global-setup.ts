import { rmSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../../src/generated/prisma/client";
import { resetTestDatabase } from "../support/reset-db";
import { TEST_DATABASE_URL } from "../support/test-env";
import { E2E } from "./constants";

/** Fresh test DB + the fixtures the happy path needs (staff, one café branch, one active campaign). */
export default async function globalSetup() {
  resetTestDatabase();
  rmSync(E2E.outbox, { force: true });
  rmSync("./.storage-test", { recursive: true, force: true });

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
  try {
    const passwordHash = await bcrypt.hash(E2E.staffPassword, 4);
    await db.staffUser.createMany({
      data: [
        { email: E2E.staff.support, name: "E2E Support", role: "SUPPORT", passwordHash },
        { email: E2E.staff.finance, name: "E2E Finance", role: "FINANCE", passwordHash },
        { email: E2E.staff.admin, name: "E2E Admin", role: "ADMIN", passwordHash },
      ],
    });
    await db.campaign.create({
      data: { name: "E2E Launch ৳500", offerType: "FIXED", value: 500_00, validityDays: 30, startsAt: new Date(Date.now() - 86_400_000), active: true },
    });
    const partner = await db.partner.create({
      data: { name: E2E.partnerName, contactName: "Owner", contactPhone: "+8801700000001", payoutMethod: "BKASH", payoutAccount: "+8801700000001" },
    });
    await db.branch.create({
      data: {
        partnerId: partner.id,
        name: E2E.branchName,
        area: "Gulshan",
        address: "Road 1",
        smsPhone: "+8801700000002",
        branchCode: E2E.branchCode,
        pinHash: await bcrypt.hash(E2E.pin, 4),
      },
    });
  } finally {
    await db.$disconnect();
  }
}
