/**
 * Live check of Neon Object Storage with the app's own storage module: upload a
 * text file and a photo, list them, read them back, then remove them. Prints no
 * credentials.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/storage-smoke.mts        (storage env set)
 */
import { deleteMedia, getMedia, mediaStore, putMedia, storageConfig } from "../lib/object-storage";

async function main() {
  const config = storageConfig();
  const store = config ? await mediaStore() : null;
  if (!config || !store) throw new Error("Object storage is not configured (NEON_STORAGE_* env).");
  console.log(`bucket "${config.bucket}" at ${new URL(config.endpoint).host} (${config.region})`);

  const stamp = Date.now().toString(36);
  const textKey = `smoke/hello-${stamp}.txt`;
  await store.upload(textKey, `Hello from AINF ${new Date().toISOString()}`, { contentType: "text/plain" });
  console.log(`uploaded ${textKey}`);

  const listed = await store.list({ prefix: "smoke/" });
  const keys = (Array.isArray(listed) ? listed : (listed as { items?: { key: string }[] }).items ?? []).map(
    (item: { key: string }) => item.key
  );
  console.log(`listed smoke/: ${keys.join(", ")}`);

  const text = await (await store.download(textKey)).text();
  console.log(`read back: "${text}"`);

  // Same path the app uses for an admin project photo (key rules, content type).
  const photoKey = `projects/smoke-${stamp}.webp`;
  const bytes = Buffer.from("RIFF0000WEBPVP8 smoke", "utf8");
  await putMedia(photoKey, bytes, "image/webp");
  const photo = await getMedia(photoKey);
  console.log(`photo round trip: ${photo && photo.bytes.equals(bytes) ? "identical" : "MISMATCH"} (${photo?.contentType})`);

  if (process.argv.includes("--keep-photo")) {
    console.log(`kept ${photoKey} for the /media check`);
  } else {
    await deleteMedia(photoKey);
  }
  await store.delete(textKey);
  console.log(`cleaned up; ${textKey} exists afterwards: ${await store.exists(textKey)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
