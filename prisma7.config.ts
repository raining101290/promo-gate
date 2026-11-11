// Prisma 7.10+ config. Named prisma7.config.ts (per Prisma 7 docs) so it does not clash with
// the Prisma 8 config format, which only accepts prisma.config.ts.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Neon/Supabase; runtime uses DATABASE_URL.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
