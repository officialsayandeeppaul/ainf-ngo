import { db } from "./db";

/**
 * ID card photos live in Postgres (CardPhoto). Serverless hosts have a
 * read-only filesystem, which is why saving a photo used to fail with a 500.
 */

/** Where the owner's own preview loads from; the version busts the browser cache. */
export function ownCardPhotoUrl(updatedAt: Date): string {
  return `/api/membership/card-photo?v=${updatedAt.getTime()}`;
}

export async function saveCardPhoto(userId: string, jpeg: Buffer): Promise<Date> {
  const bytes = new Uint8Array(jpeg);
  const row = await db.cardPhoto.upsert({
    where: { userId },
    create: { userId, bytes, mime: "image/jpeg" },
    update: { bytes, mime: "image/jpeg" },
    select: { updatedAt: true },
  });
  return row.updatedAt;
}

export async function loadCardPhoto(userId: string): Promise<{ bytes: Buffer; mime: string; updatedAt: Date } | null> {
  const row = await db.cardPhoto.findUnique({ where: { userId } });
  if (!row) return null;
  return { bytes: Buffer.from(row.bytes), mime: row.mime, updatedAt: row.updatedAt };
}

/** The photo as a data URI for the card SVG, or null when none was saved. */
export async function cardPhotoDataUri(userId: string): Promise<string | null> {
  try {
    const photo = await loadCardPhoto(userId);
    return photo ? `data:${photo.mime};base64,${photo.bytes.toString("base64")}` : null;
  } catch (error) {
    console.error("[card-photo] load failed", error);
    return null;
  }
}
