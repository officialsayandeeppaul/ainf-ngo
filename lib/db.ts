import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env, isProduction, requireDatabaseEnv } from "./env";
import { neonPoolConfig } from "./pg";

/**
 * Lazily constructed Prisma singleton.
 *
 * Construction is deferred behind a Proxy so importing this module never throws
 * when DATABASE_URL is absent — only actually touching the database does. That
 * keeps the static Framer routes and unconfigured local setups serving while
 * still failing loudly with a precise message the moment a query is attempted.
 *
 * Prisma 7 requires an explicit driver adapter. The pooled DATABASE_URL is used
 * here; Prisma Migrate reads DIRECT_URL from prisma.config.ts instead.
 */

const globalForPrisma = globalThis as unknown as {
  __ainfPrismaNeon?: PrismaClient;
  __ainfPrismaRecreated?: boolean;
  __ainfPrismaDelegateGen?: number;
};

/** Bump when new Prisma models are added so a stale singleton is rebuilt once. */
const PRISMA_DELEGATE_GEN = 6;

function createClient(): PrismaClient {
  requireDatabaseEnv();
  const adapter = new PrismaPg(
    neonPoolConfig(env.DATABASE_URL!, {
      // Serverless invocations are short-lived and numerous; a small ceiling per
      // instance keeps total connections under Neon's limit.
      max: isProduction ? 5 : 3,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    })
  );
  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["error", "warn"],
  });
}

type ClientDelegates = PrismaClient & {
  membershipTier?: unknown;
  membershipSettings?: unknown;
  membershipOrder?: unknown;
  membershipOffer?: unknown;
  membershipCard?: unknown;
  contactMessage?: unknown;
  supportBanner?: unknown;
  fieldProject?: unknown;
  donationSettings?: unknown;
  donationMission?: unknown;
  donation?: unknown;
};

/** True when this process still holds a PrismaClient built before a later `prisma generate`. */
function isStaleClient(client: PrismaClient): boolean {
  const row = client as ClientDelegates;
  return (
    typeof row.membershipTier === "undefined" ||
    typeof row.membershipSettings === "undefined" ||
    typeof row.membershipOrder === "undefined" ||
    typeof row.membershipOffer === "undefined" ||
    typeof row.membershipCard === "undefined" ||
    typeof row.contactMessage === "undefined" ||
    typeof row.supportBanner === "undefined" ||
    typeof row.fieldProject === "undefined" ||
    typeof row.donationSettings === "undefined" ||
    typeof row.donation === "undefined"
  );
}

export function membershipCardDelegate() {
  const row = getDb() as ClientDelegates;
  return row.membershipCard ?? null;
}

export function supportBannerDelegate() {
  const row = getDb() as ClientDelegates;
  return row.supportBanner ?? null;
}

export function fieldProjectDelegate() {
  const row = getDb() as ClientDelegates;
  return row.fieldProject ?? null;
}

export function getDb(): PrismaClient {
  if (globalForPrisma.__ainfPrismaDelegateGen !== PRISMA_DELEGATE_GEN) {
    globalForPrisma.__ainfPrismaDelegateGen = PRISMA_DELEGATE_GEN;
    globalForPrisma.__ainfPrismaRecreated = false;
  }

  const existing = globalForPrisma.__ainfPrismaNeon;
  if (existing && !isStaleClient(existing)) return existing;
  // Webpack can keep an old PrismaClient class after `prisma generate`. A new
  // instance of that class is still missing later delegates, so recreating
  // again would only `$disconnect()` a live pool on every request.
  if (existing && globalForPrisma.__ainfPrismaRecreated) return existing;
  if (existing) void existing.$disconnect();
  const client = createClient();
  globalForPrisma.__ainfPrismaNeon = client;
  if (isStaleClient(client)) globalForPrisma.__ainfPrismaRecreated = true;
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
