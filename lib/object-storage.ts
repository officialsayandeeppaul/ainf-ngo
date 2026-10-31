import { Files, FilesError } from "files-sdk";
import { neon } from "files-sdk/neon";

/**
 * Neon Object Storage (S3-compatible, private bucket) for files the site's users
 * produce: ID card photos and admin project photos. Keeping them out of Postgres
 * and out of the deployment keeps both small; `/media/<key>` serves them.
 *
 * Credentials: Vercel reserves AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
 * AWS_REGION for its own runtime, so production sets the NEON_STORAGE_* names.
 * Locally the AWS_* names that `neon env pull` writes are used as a set, never
 * mixed with NEON_STORAGE_* ones. Without either set, storage is off and callers
 * keep their previous behaviour.
 */

export const MEDIA_PREFIX = "/media/";

type StorageConfig = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function storageConfig(env: Record<string, string | undefined> = process.env): StorageConfig | null {
  const bucket = env.NEON_STORAGE_BUCKET || "uploads";
  if (env.NEON_STORAGE_ENDPOINT && env.NEON_STORAGE_ACCESS_KEY_ID && env.NEON_STORAGE_SECRET_ACCESS_KEY) {
    return {
      bucket,
      endpoint: env.NEON_STORAGE_ENDPOINT,
      region: env.NEON_STORAGE_REGION || "us-east-1",
      accessKeyId: env.NEON_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.NEON_STORAGE_SECRET_ACCESS_KEY,
    };
  }
  if (env.AWS_ENDPOINT_URL_S3 && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && !env.VERCEL) {
    return {
      bucket,
      endpoint: env.AWS_ENDPOINT_URL_S3,
      region: env.AWS_REGION || "us-east-1",
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    };
  }
  return null;
}

let client: Files | null | undefined;

/** The bucket client, or null when storage is not configured. */
export function mediaStore(): Files | null {
  if (client !== undefined) return client;
  const config = storageConfig();
  client = config
    ? new Files({
        adapter: neon({
          bucket: config.bucket,
          endpoint: config.endpoint,
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }),
      })
    : null;
  return client;
}

/** Tests swap in an in-memory store (files-sdk/memory), or null for "not configured". */
export function setMediaStoreForTests(store: Files | null | undefined) {
  client = store;
}

/** Keys are ours (prefix/name.ext); anything else is refused before it reaches the bucket. */
const MEDIA_KEY = /^(?:card-photos|projects)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?\.(?:jpg|webp)$/;

export function isMediaKey(key: string): boolean {
  return MEDIA_KEY.test(key);
}

export function mediaUrl(key: string): string {
  return `${MEDIA_PREFIX}${key}`;
}

export async function putMedia(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const store = mediaStore();
  if (!store) throw new Error("Object storage is not configured");
  if (!isMediaKey(key)) throw new Error(`Refusing media key ${key}`);
  await store.upload(key, new Uint8Array(bytes), { contentType });
}

export async function getMedia(key: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const store = mediaStore();
  if (!store || !isMediaKey(key)) return null;
  try {
    const file = await store.download(key);
    return { bytes: Buffer.from(await file.arrayBuffer()), contentType: file.contentType };
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") return null;
    throw error;
  }
}

export async function deleteMedia(key: string): Promise<void> {
  const store = mediaStore();
  if (!store || !isMediaKey(key)) return;
  try {
    await store.delete(key);
  } catch (error) {
    if (error instanceof FilesError && error.code === "NotFound") return;
    throw error;
  }
}
