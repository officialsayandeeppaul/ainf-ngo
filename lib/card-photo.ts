import { randomBytes } from "node:crypto";
import { db } from "./db";
import { deleteMedia, getMedia, mediaStore, putMedia } from "./object-storage";

/**
 * ID card photos. With Neon Object Storage configured the JPEG goes to the
 * bucket (private; only the owner's preview route and the card renderer read
 * it) and the CardPhoto row keeps just the key. Without it, or for photos saved
 * before, the bytes stay in Postgres. Serverless hosts have a read-only
 * filesystem, so neither ever touches disk.
 */

/** Where the owner's own preview loads from; the version busts the browser cache. */
export function ownCardPhotoUrl(updatedAt: Date): string {
  return `/api/membership/card-photo?v=${updatedAt.getTime()}`;
}

/** A new key per save, so a cached old photo can never be served for the new one. */
export function cardPhotoKey(userId: string): string {
  return `card-photos/${userId}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.jpg`;
}

export async function saveCardPhoto(userId: string, jpeg: Buffer): Promise<Date> {
  if (!mediaStore()) {
    const bytes = new Uint8Array(jpeg);
    const row = await db.cardPhoto.upsert({
      where: { userId },
      create: { userId, bytes, mime: "image/jpeg" },
      update: { bytes, storageKey: null, mime: "image/jpeg" },
      select: { updatedAt: true },
    });
    return row.updatedAt;
  }

  const previous = await db.cardPhoto.findUnique({ where: { userId }, select: { storageKey: true } });
  const storageKey = cardPhotoKey(userId);
  await putMedia(storageKey, jpeg, "image/jpeg");
  const row = await db.cardPhoto.upsert({
    where: { userId },
    create: { userId, storageKey, mime: "image/jpeg" },
    update: { storageKey, bytes: null, mime: "image/jpeg" },
    select: { updatedAt: true },
  });
  if (previous?.storageKey && previous.storageKey !== storageKey) {
    // The row already points at the new photo; a leftover old object only costs space.
    await deleteMedia(previous.storageKey).catch((error) =>
      console.error("[card-photo] could not delete the previous photo", error)
    );
  }
  return row.updatedAt;
}

export async function loadCardPhoto(userId: string): Promise<{ bytes: Buffer; mime: string; updatedAt: Date } | null> {
  const row = await db.cardPhoto.findUnique({ where: { userId } });
  if (!row) return null;
  if (row.storageKey) {
    const stored = await getMedia(row.storageKey);
    if (stored) return { bytes: stored.bytes, mime: stored.contentType || row.mime, updatedAt: row.updatedAt };
  }
  if (row.bytes) return { bytes: Buffer.from(row.bytes), mime: row.mime, updatedAt: row.updatedAt };
  return null;
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
