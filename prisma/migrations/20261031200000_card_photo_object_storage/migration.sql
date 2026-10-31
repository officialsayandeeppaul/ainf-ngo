-- ID card photos move to Neon Object Storage: the row keeps the bucket key and
-- the bytes column becomes optional (rows saved before keep their bytes until
-- scripts/move-card-photos-to-storage.ts moves them). Additive only.

ALTER TABLE "CardPhoto" ADD COLUMN "storageKey" TEXT,
ALTER COLUMN "bytes" DROP NOT NULL;
