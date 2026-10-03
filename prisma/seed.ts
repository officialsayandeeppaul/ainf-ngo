import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
import { PrismaPg } from "@prisma/adapter-pg";
import { KycStatus, PrismaClient, Role, UserStatus } from "@prisma/client";
import { SAMPLE_PLAN_BENEFITS } from "../lib/plan-benefits";
import { neonPoolConfig } from "../lib/pg";

/**
 * Idempotent seed.
 *
 * Deliberately does NOT create a super admin: that role can only be granted
 * through /admin/bootstrap, which requires the bootstrap key plus enrolled TOTP
 * MFA and writes an audit record. Seeding one would bypass both controls.
 *
 * Set SEED_DEMO_USERS=true to add non-privileged sample rows for local UI work.
 */

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL (or DIRECT_URL) in .env.local before seeding.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(neonPoolConfig(connectionString)),
});

const DEMO_USERS = [
  {
    clerkId: "seed_user_standard",
    email: "member@example.test",
    firstName: "Standard",
    lastName: "Member",
    role: Role.USER,
    kycStatus: KycStatus.NOT_STARTED,
    panVerified: false,
  },
  {
    clerkId: "seed_user_pending",
    email: "pending@example.test",
    firstName: "Pending",
    lastName: "Review",
    role: Role.USER,
    kycStatus: KycStatus.IN_REVIEW,
    panVerified: false,
  },
  {
    clerkId: "seed_user_verified",
    email: "verified@example.test",
    firstName: "Verified",
    lastName: "Member",
    role: Role.VERIFIED_USER,
    kycStatus: KycStatus.APPROVED,
    panVerified: true,
  },
];

async function main() {
  const counts = await prisma.user.count();
  console.log(`Connected. Existing users: ${counts}`);

  if (process.env.SEED_DEMO_USERS === "true") {
    for (const user of DEMO_USERS) {
      const row = await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: { ...user, status: UserStatus.ACTIVE },
      });
      console.log(`  seeded ${row.email} (${row.role})`);
    }
  } else {
    console.log("Skipping demo users. Set SEED_DEMO_USERS=true to create them.");
  }

  const admins = await prisma.user.count({ where: { role: Role.SUPER_ADMIN } });
  console.log(
    admins === 0
      ? "No super admin yet. Sign up, enrol TOTP MFA, then visit /admin/bootstrap."
      : `Super admins present: ${admins}`
  );

  await prisma.membershipSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", yearlyDiscountKind: "PERCENT", yearlyDiscountValue: 20 },
    update: {},
  });

  const sampleTiers = [
    {
      slug: "friend",
      name: "Friend of AINF",
      badge: "Friend",
      badgeColor: "#1f6f8b",
      description: "Monthly support for field programmes, with a member badge on your account.",
      benefits: SAMPLE_PLAN_BENEFITS.friend,
      monthlyPaise: 19900,
      yearlyDiscountKind: "FLAT" as const,
      yearlyDiscountValue: 40000,
      sortOrder: 10,
    },
    {
      slug: "gold",
      name: "Gold member",
      badge: "Gold",
      badgeColor: "#c9a227",
      description: "Gold badge, donor roll, and yearly discount on 12 months.",
      benefits: SAMPLE_PLAN_BENEFITS.gold,
      monthlyPaise: 49900,
      yearlyDiscountKind: "PERCENT" as const,
      yearlyDiscountValue: 20,
      sortOrder: 20,
    },
    {
      slug: "patron",
      name: "Patron",
      badge: "Patron",
      badgeColor: "#8e3a59",
      description: "Highest badge. Field-visit invites and a larger yearly discount.",
      benefits: SAMPLE_PLAN_BENEFITS.patron,
      monthlyPaise: 99900,
      yearlyDiscountKind: "PERCENT" as const,
      yearlyDiscountValue: 25,
      sortOrder: 30,
    },
  ];

  for (const tier of sampleTiers) {
    const row = await prisma.membershipTier.upsert({
      where: { slug: tier.slug },
      update: {},
      create: { ...tier, active: true },
    });
    console.log(`  plan ${row.slug} (${row.name})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
