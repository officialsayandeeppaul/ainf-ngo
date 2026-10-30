-- Suspensions carry a duration, who made them, and how the member was told.
-- ID card photos move into Postgres (the serverless filesystem is read-only).
-- Additive only.

ALTER TABLE "User" ADD COLUMN "suspendedUntil" TIMESTAMP(3),
ADD COLUMN "suspendedByUserId" TEXT,
ADD COLUMN "suspensionNoticeChannel" TEXT,
ADD COLUMN "suspensionNoticeSentAt" TIMESTAMP(3);

CREATE TABLE "CardPhoto" (
    "userId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPhoto_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "CardPhoto" ADD CONSTRAINT "CardPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
