-- Admin payment controls: an online-payments switch, the interest queue it
-- fills while paused, Razorpay payment links sent from that queue, free
-- membership grants, and admin identity verification. Additive only.

CREATE TYPE "PaymentPurpose" AS ENUM ('DONATION', 'MEMBERSHIP');
CREATE TYPE "PaymentInterestStatus" AS ENUM ('OPEN', 'CONTACTED', 'LINK_SENT', 'PAID', 'DISMISSED');
CREATE TYPE "PaymentLinkStatus" AS ENUM ('CREATED', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED');

-- Brings these defaults in line with schema.prisma (the row already exists, so no value changes).
ALTER TABLE "DonationSettings" ALTER COLUMN "minPaise" SET DEFAULT 20000,
ALTER COLUMN "suggestedPaise" SET DEFAULT ARRAY[20000, 50000, 100000, 250000]::INTEGER[];

ALTER TABLE "MembershipOrder" ADD COLUMN "grantNote" TEXT,
ADD COLUMN "grantedByUserId" TEXT;

ALTER TABLE "User" ADD COLUMN "identityVerifiedByAdminAt" TIMESTAMP(3),
ADD COLUMN "identityVerifiedByUserId" TEXT,
ADD COLUMN "identityVerifiedNote" TEXT;

CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pausedMessage" TEXT NOT NULL DEFAULT '',
    "pausedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaymentSettings" ("id", "enabled", "updatedAt") VALUES ('singleton', true, CURRENT_TIMESTAMP);

CREATE TABLE "PaymentInterest" (
    "id" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentInterestStatus" NOT NULL DEFAULT 'OPEN',
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "donationKind" "DonationKind",
    "targetSlug" TEXT,
    "targetTitle" TEXT NOT NULL,
    "tierId" TEXT,
    "interval" "BillingInterval",
    "source" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminNote" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInterest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'CREATED',
    "interestId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "razorpayLinkId" TEXT,
    "shortUrl" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "donationId" TEXT,
    "membershipOrderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notifySms" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentInterest_status_createdAt_idx" ON "PaymentInterest"("status", "createdAt");
CREATE INDEX "PaymentInterest_purpose_status_idx" ON "PaymentInterest"("purpose", "status");
CREATE INDEX "PaymentInterest_email_idx" ON "PaymentInterest"("email");
CREATE INDEX "PaymentInterest_userId_idx" ON "PaymentInterest"("userId");

CREATE UNIQUE INDEX "PaymentLink_razorpayLinkId_key" ON "PaymentLink"("razorpayLinkId");
CREATE UNIQUE INDEX "PaymentLink_razorpayPaymentId_key" ON "PaymentLink"("razorpayPaymentId");
CREATE UNIQUE INDEX "PaymentLink_donationId_key" ON "PaymentLink"("donationId");
CREATE UNIQUE INDEX "PaymentLink_membershipOrderId_key" ON "PaymentLink"("membershipOrderId");
CREATE INDEX "PaymentLink_status_createdAt_idx" ON "PaymentLink"("status", "createdAt");
CREATE INDEX "PaymentLink_interestId_idx" ON "PaymentLink"("interestId");

ALTER TABLE "PaymentInterest" ADD CONSTRAINT "PaymentInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentInterest" ADD CONSTRAINT "PaymentInterest_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "PaymentInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_membershipOrderId_fkey" FOREIGN KEY ("membershipOrderId") REFERENCES "MembershipOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
