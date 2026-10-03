-- CreateEnum
CREATE TYPE "YearlyDiscountKind" AS ENUM ('NONE', 'PERCENT', 'FLAT');

-- CreateTable
CREATE TABLE "MembershipTier" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "badgeColor" TEXT NOT NULL DEFAULT '#39a46b',
    "description" TEXT NOT NULL DEFAULT '',
    "monthlyPaise" INTEGER NOT NULL,
    "yearlyDiscountKind" "YearlyDiscountKind" NOT NULL DEFAULT 'PERCENT',
    "yearlyDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "yearlyDiscountKind" "YearlyDiscountKind" NOT NULL DEFAULT 'PERCENT',
    "yearlyDiscountValue" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTier_slug_key" ON "MembershipTier"("slug");

-- CreateIndex
CREATE INDEX "MembershipTier_active_sortOrder_idx" ON "MembershipTier"("active", "sortOrder");
