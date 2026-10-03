-- CreateEnum
CREATE TYPE "OfferKind" AS ENUM ('PERCENT', 'FLAT');

-- CreateEnum
CREATE TYPE "MembershipChangeKind" AS ENUM ('NEW', 'RENEWAL', 'UPGRADE', 'DOWNGRADE', 'INTERVAL_CHANGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "membershipPeriodStartedAt" TIMESTAMP(3),
ADD COLUMN "membershipTermPaise" INTEGER;

-- AlterTable
ALTER TABLE "MembershipOrder" ADD COLUMN "changeKind" "MembershipChangeKind" NOT NULL DEFAULT 'NEW',
ADD COLUMN "restartTerm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "listPaise" INTEGER,
ADD COLUMN "creditPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "previousTierId" TEXT,
ADD COLUMN "offerId" TEXT;

-- CreateTable
CREATE TABLE "MembershipOffer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OfferKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "interval" "BillingInterval",
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstCycleOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipOfferOnTier" (
    "offerId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,

    CONSTRAINT "MembershipOfferOnTier_pkey" PRIMARY KEY ("offerId","tierId")
);

-- CreateIndex
CREATE INDEX "MembershipOffer_active_startsAt_endsAt_idx" ON "MembershipOffer"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "MembershipOfferOnTier_tierId_idx" ON "MembershipOfferOnTier"("tierId");

-- AddForeignKey
ALTER TABLE "MembershipOfferOnTier" ADD CONSTRAINT "MembershipOfferOnTier_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MembershipOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOfferOnTier" ADD CONSTRAINT "MembershipOfferOnTier_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipOrder" ADD CONSTRAINT "MembershipOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "MembershipOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
