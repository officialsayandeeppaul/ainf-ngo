import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * Prisma CLI configuration (migrations, introspection, seeding).
 *
 * The CLI always uses the direct, unpooled connection: PgBouncer-style poolers
 * cannot run the DDL and advisory locks that Prisma Migrate needs. The runtime
 * client uses the pooled DATABASE_URL via a driver adapter in lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Neon exposes both a pooled and a direct string; some projects only set
    // one, so fall back rather than failing with an opaque CLI error.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
