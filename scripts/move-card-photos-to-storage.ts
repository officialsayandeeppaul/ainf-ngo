/**
 * Moves ID card photos saved in Postgres (CardPhoto.bytes) into Neon Object
 * Storage and clears the bytes, so the database keeps only the key.
 *
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/move-card-photos-to-storage.ts
 *
 * Needs DATABASE_URL and the storage env (NEON_STORAGE_* or AWS_*). Each photo
 * is uploaded and read back before its bytes are cleared, so a failure leaves
 * that row as it was. Safe to run again.
 */
import { cardPhotoKey } from "../lib/card-photo";
import { db } from "../lib/db";
import { getMedia, mediaStore, putMedia } from "../lib/object-storage";

async function main() {
  if (!mediaStore()) throw new Error("Object storage is not configured (NEON_STORAGE_* or AWS_* env).");
  const rows = await db.cardPhoto.findMany({
    where: { bytes: { not: null }, storageKey: null },
    select: { userId: true },
  });
  console.log(`${rows.length} photo(s) to move`);
  let moved = 0;
  for (const { userId } of rows) {
    const row = await db.cardPhoto.findUnique({ where: { userId } });
    if (!row?.bytes || row.storageKey) continue;
    const bytes = Buffer.from(row.bytes);
    const key = cardPhotoKey(userId);
    await putMedia(key, bytes, row.mime);
    const check = await getMedia(key);
    if (!check || !check.bytes.equals(bytes)) throw new Error(`Read-back mismatch for ${userId}; row left unchanged`);
    // updatedAt is left alone so the owner's cached preview URL stays valid.
    await db.$executeRaw`UPDATE "CardPhoto" SET "storageKey" = ${key}, "bytes" = NULL WHERE "userId" = ${userId} AND "storageKey" IS NULL`;
    moved += 1;
  }
  console.log(`moved ${moved}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
