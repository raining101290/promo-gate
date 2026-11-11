// Creates the FIRST admin on the server (no demo data). Refuses if an admin already exists.
// Run on the server after the first deploy:
//   cd ~/perks/current/migrate && ADMIN_EMAIL=you@cloudhosti.com ADMIN_NAME="Your Name" node create-admin.mjs
// Prints a one-time password; the admin must change it at first login. Same rules as prisma/seed-admin.ts,
// but uses plain pg + bcryptjs (installed next to the Prisma CLI by activate.sh) instead of the app's client.
import "dotenv/config";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import pg from "pg";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const name = process.env.ADMIN_NAME?.trim() || "Administrator";
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Set ADMIN_EMAIL");

const client = new pg.Client({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`select count(*)::int as n from "StaffUser" where role = 'ADMIN'`);
  if (rows[0].n > 0) {
    console.log(`An admin already exists (${rows[0].n}); nothing to do. Add more staff from the admin UI.`);
  } else {
    const password = randomBytes(15).toString("base64url");
    const id = "c" + randomBytes(16).toString("hex").slice(0, 24); // cuid-shaped; ids are opaque strings
    await client.query(
      `insert into "StaffUser" (id, email, name, "passwordHash", role, "mustChangePassword") values ($1, $2, $3, $4, 'ADMIN', true)`,
      [id, email, name, await bcrypt.hash(password, 12)],
    );
    console.log(`Created admin ${email}.`);
    console.log(`One-time password (change it at first login): ${password}`);
  }
} finally {
  await client.end();
}
