import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../../src/generated/prisma/client";
import { resetTestDatabase } from "../support/reset-db";
import { TEST_DATABASE_URL } from "../support/test-env";
import { GUIDE } from "./constants";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

/** Fresh test DB filled with a small, realistic programme so every screen has something to show. */
export default async function globalSetup() {
  resetTestDatabase();
  rmSync(GUIDE.outbox, { force: true });
  rmSync("./.storage-test", { recursive: true, force: true });

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
  try {
    const passwordHash = await bcrypt.hash(GUIDE.staffPassword, 4);
    const [support] = await Promise.all(
      (["support", "finance", "admin"] as const).map((r) =>
        db.staffUser.create({ data: { email: GUIDE.staff[r].email, name: GUIDE.staff[r].name, role: r.toUpperCase() as "SUPPORT", passwordHash } }),
      ),
    );

    const launch = await db.campaign.create({
      data: {
        name: "Launch offer ৳500",
        offerType: "FIXED",
        value: 500_00,
        minBill: 400_00,
        validityDays: 30,
        totalBudget: 150_000_00,
        startsAt: ago(20 * DAY),
        active: true,
      },
    });
    await db.campaign.create({
      data: { name: "Eid 20% off", offerType: "PERCENT", value: 2000, maxDiscount: 250_00, validityDays: 14, startsAt: ago(60 * DAY), active: false },
    });

    const pinHash = await bcrypt.hash(GUIDE.branch.pin, 4);
    const bean = await db.partner.create({
      data: { name: GUIDE.partner, contactName: "Rafiq Islam", contactPhone: "+8801711000001", payoutMethod: "BKASH", payoutAccount: "+8801711000001" },
    });
    const gulshan = await db.branch.create({
      data: {
        partnerId: bean.id,
        name: GUIDE.branch.name,
        area: "Gulshan",
        address: "House 12, Road 35, Gulshan 2, Dhaka",
        smsPhone: "+8801711000002",
        branchCode: GUIDE.branch.code,
        pinHash,
      },
    });
    await db.branch.create({
      data: { partnerId: bean.id, name: "Dhanmondi 27", area: "Dhanmondi", address: "Road 27, Dhanmondi, Dhaka", smsPhone: "+8801711000003", branchCode: "beanhouse-dhanmondi27", pinHash },
    });
    const tea = await db.partner.create({
      data: { name: "Tea Leaf Roasters", contactName: "Sumaiya Akter", contactPhone: "+8801811000001", payoutMethod: "BANK", payoutAccount: "City Bank 1234567890" },
    });
    const banani = await db.branch.create({
      data: { partnerId: tea.id, name: "Banani 11", area: "Banani", address: "Road 11, Banani, Dhaka", smsPhone: "+8801811000002", branchCode: "tealeaf-banani11", pinHash },
    });

    // Background customers: pending, approved (some redeemed and verified), rejected.
    const people: { name: string; status: "PENDING" | "APPROVED" | "REJECTED"; redeemed?: "VERIFIED" | "CLAIMED"; at: number; bill?: number }[] = [
      { name: "Farhana Chowdhury", status: "PENDING", at: 2 * HOUR },
      { name: "Sakib Hasan", status: "PENDING", at: 5 * HOUR },
      { name: "Nusrat Jahan", status: "PENDING", at: 26 * HOUR },
      { name: "Arif Mahmud", status: "APPROVED", redeemed: "VERIFIED", at: 9 * DAY, bill: 620_00 },
      { name: "Tasnim Kabir", status: "APPROVED", redeemed: "VERIFIED", at: 8 * DAY, bill: 720_00 },
      { name: "Rakib Uddin", status: "APPROVED", redeemed: "VERIFIED", at: 6 * DAY, bill: 980_00 },
      { name: "Mehnaz Sultana", status: "APPROVED", redeemed: "CLAIMED", at: 3 * HOUR, bill: 860_00 },
      { name: "Shafiq Rahman", status: "APPROVED", at: 2 * DAY },
      { name: "Jannat Ara", status: "REJECTED", at: 4 * DAY },
    ];
    let n = 0;
    for (const p of people) {
      n++;
      const slug = p.name.toLowerCase().replace(/\s+/g, ".");
      const customer = await db.customer.create({
        data: { name: p.name, email: `${slug}@example.com`, phone: `+88017000000${String(n).padStart(2, "0")}`, createdAt: ago(p.at) },
      });
      const req = await db.offerRequest.create({
        data: {
          customerId: customer.id,
          invoiceNumber: `INV-2044${String(n).padStart(2, "0")}`,
          submittedEmail: customer.email,
          submittedPhone: customer.phone,
          status: p.status,
          createdAt: ago(p.at),
          ...(p.status !== "PENDING" && { reviewedById: support.id, reviewedAt: ago(p.at - HOUR) }),
          ...(p.status === "REJECTED" && { rejectReason: "This invoice is not paid yet" }),
        },
      });
      if (p.status !== "APPROVED") continue;
      const issued = ago(p.at - HOUR);
      const voucher = await db.voucher.create({
        data: {
          offerRequestId: req.id,
          campaignId: launch.id,
          customerId: customer.id,
          code: randomBytes(18).toString("base64url"),
          status: p.redeemed ? "REDEEMED" : "ACTIVE",
          issuedAt: issued,
          expiresAt: new Date(issued.getTime() + 30 * DAY),
          offerType: "FIXED",
          value: 500_00,
          minBill: 400_00,
          faceValue: 500_00,
        },
      });
      if (!p.redeemed || !p.bill) continue;
      const redeemedAt = ago(p.at - 2 * DAY > 0 ? p.at - 2 * DAY : p.at / 2);
      await db.redemption.create({
        data: {
          voucherId: voucher.id,
          branchId: p.redeemed === "CLAIMED" ? banani.id : gulshan.id,
          customerId: customer.id,
          billAmount: p.bill,
          discountAmount: 500_00,
          customerPaid: p.bill - 500_00,
          posReceiptNo: `00${4400 + n}`,
          status: p.redeemed,
          redeemedAt,
          createdAt: redeemedAt,
          ...(p.redeemed === "VERIFIED" && { verifiedById: support.id, reviewedAt: new Date(redeemedAt.getTime() + 3 * HOUR) }),
        },
      });
    }
  } finally {
    await db.$disconnect();
  }
}
