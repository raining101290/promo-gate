// CLI staff provisioning (the admin UI at /admin/staff does the same). Useful before any admin exists (needs an existing ADMIN to have been
// created with `npm run db:seed-admin`). Prints a one-time random password.
//   STAFF_EMAIL=agent@hosting.com STAFF_NAME="Support Agent" STAFF_ROLE=SUPPORT npm run staff:create
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient, type StaffRole } from "../src/generated/prisma/client";

const email = process.env.STAFF_EMAIL?.trim().toLowerCase() ?? "";
const name = process.env.STAFF_NAME?.trim() ?? "";
const role = process.env.STAFF_ROLE as StaffRole;
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || !["SUPPORT", "FINANCE", "ADMIN"].includes(role)) {
  throw new Error("Set STAFF_EMAIL, STAFF_NAME and STAFF_ROLE (SUPPORT | FINANCE | ADMIN)");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL! }) });

async function main() {
  if (await prisma.staffUser.findUnique({ where: { email } })) throw new Error(`${email} already exists`);
  const password = randomBytes(15).toString("base64url");
  await prisma.staffUser.create({ data: { email, name, role, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true } });
  await prisma.auditLog.create({ data: { actorType: "SYSTEM", actorId: "cli", action: "staff.created", entityType: "StaffUser", entityId: email, meta: { role } } });
  console.log(`Created ${role} ${email}. One-time password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
