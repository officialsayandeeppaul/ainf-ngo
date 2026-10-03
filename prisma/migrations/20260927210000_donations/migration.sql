-- Open gifts: admin floors, missions, and one-time donations separate from membership.

ALTER TABLE "FieldProject" ADD COLUMN "acceptDonations" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FieldProject" ADD COLUMN "donateMinPaise" INTEGER;

CREATE TYPE "DonationKind" AS ENUM ('GENERAL', 'MISSION', 'PROJECT');
CREATE TYPE "DonationStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');

CREATE TABLE "DonationSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "minPaise" INTEGER NOT NULL DEFAULT 10000,
    "maxPaise" INTEGER NOT NULL DEFAULT 10000000,
    "suggestedPaise" INTEGER[] DEFAULT ARRAY[50000, 100000, 250000]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "DonationSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DonationSettings" ("id", "minPaise", "maxPaise", "suggestedPaise", "updatedAt")
VALUES ('singleton', 10000, 10000000, ARRAY[50000, 100000, 250000]::INTEGER[], CURRENT_TIMESTAMP);

CREATE TABLE "DonationMission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minPaise" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "DonationMission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DonationMission_slug_key" ON "DonationMission"("slug");
CREATE INDEX "DonationMission_published_sortOrder_idx" ON "DonationMission"("published", "sortOrder");

INSERT INTO "DonationMission" ("id", "slug", "title", "published", "sortOrder", "updatedAt") VALUES
('mission_shiksha', 'shiksha', 'Shiksha', true, 0, CURRENT_TIMESTAMP),
('mission_swasthya', 'swasthya', 'Swasthya', true, 1, CURRENT_TIMESTAMP),
('mission_rozgar', 'rozgar', 'Rozgar', true, 2, CURRENT_TIMESTAMP),
('mission_nari', 'nari-suraksha', 'Nari Suraksha', true, 3, CURRENT_TIMESTAMP),
('mission_janajati', 'janajati', 'Janajati', true, 4, CURRENT_TIMESTAMP);

CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "kind" "DonationKind" NOT NULL,
    "missionId" TEXT,
    "projectId" TEXT,
    "targetTitle" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "donorPhone" TEXT NOT NULL,
    "receiptToken" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpayRefundId" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'CREATED',
    "receiptEmailedAt" TIMESTAMP(3),
    "refundEmailedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Donation_receiptToken_key" ON "Donation"("receiptToken");
CREATE UNIQUE INDEX "Donation_razorpayOrderId_key" ON "Donation"("razorpayOrderId");
CREATE UNIQUE INDEX "Donation_razorpayPaymentId_key" ON "Donation"("razorpayPaymentId");
CREATE INDEX "Donation_status_createdAt_idx" ON "Donation"("status", "createdAt");
CREATE INDEX "Donation_kind_idx" ON "Donation"("kind");

ALTER TABLE "Donation" ADD CONSTRAINT "Donation_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "DonationMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "FieldProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
