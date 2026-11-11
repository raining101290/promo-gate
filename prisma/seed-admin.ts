// Production-safe bootstrap: creates the FIRST admin only (no demo data). Refuses if an admin exists.
//   ADMIN_EMAIL=you@hosting.com ADMIN_NAME="Your Name" npm run db:seed-admin
// A random password is generated and printed once (or pass ADMIN_PASSWORD, 12+ chars).
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const rawEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Administrator";
if (!rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) throw new Error("Set ADMIN_EMAIL");
const email: string = rawEmail;
const password = process.env.ADMIN_PASSWORD ?? randomBytes(15).toString("base64url");
if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL! }) });

async function main() {
  const existing = await prisma.staffUser.count({ where: { role: "ADMIN" } });
  if (existing > 0) {
    console.log(`An admin already exists (${existing}); nothing to do. Add more staff from the admin UI.`);
    return;
  }
  await prisma.staffUser.create({ data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12), mustChangePassword: !process.env.ADMIN_PASSWORD } });
  console.log(`Created admin ${email}.`);
  if (!process.env.ADMIN_PASSWORD) console.log(`Password (shown once, store it in your password manager): ${password}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
