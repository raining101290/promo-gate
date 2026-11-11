import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  // Serverless: many instances each hold a pool. Keep it small and point DATABASE_URL at the provider's
  // pooled endpoint (Neon "-pooler" host / Supabase port 6543).
  const max = Number(process.env.DB_POOL_MAX ?? 5);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
}

// Reuse one client across dev hot reloads; a fresh module scope would otherwise open a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
