import { afterEach, describe, expect, it } from "vitest";
import { Files } from "files-sdk";
import { memory } from "files-sdk/memory";
import {
  deleteMedia,
  getMedia,
  isMediaKey,
  mediaUrl,
  putMedia,
  setMediaStoreForTests,
  storageConfig,
} from "@/lib/object-storage";

afterEach(() => setMediaStoreForTests(undefined));

describe("storage config", () => {
  it("prefers the NEON_STORAGE_* names", () => {
    const config = storageConfig({
      NEON_STORAGE_ENDPOINT: "https://s3.example",
      NEON_STORAGE_ACCESS_KEY_ID: "id",
      NEON_STORAGE_SECRET_ACCESS_KEY: "secret",
      NEON_STORAGE_REGION: "ap-southeast-1",
      AWS_ACCESS_KEY_ID: "vercel-own",
    });
    expect(config).toMatchObject({ endpoint: "https://s3.example", accessKeyId: "id", region: "ap-southeast-1", bucket: "uploads" });
  });

  it("uses the AWS_* names from `neon env pull` locally, never on Vercel", () => {
    const env = { AWS_ENDPOINT_URL_S3: "https://s3.example", AWS_ACCESS_KEY_ID: "id", AWS_SECRET_ACCESS_KEY: "secret" };
    expect(storageConfig(env)).toMatchObject({ accessKeyId: "id" });
    // On Vercel those names hold the platform's own credentials.
    expect(storageConfig({ ...env, VERCEL: "1" })).toBeNull();
  });

  it("is off without a complete set", () => {
    expect(storageConfig({ NEON_STORAGE_ENDPOINT: "https://s3.example" })).toBeNull();
    expect(storageConfig({})).toBeNull();
  });
});

describe("media keys", () => {
  it("only accepts our own key shapes", () => {
    expect(isMediaKey("projects/mh1x-0a1b2c3d.webp")).toBe(true);
    expect(isMediaKey("card-photos/cku1/mh1x-a1b2c3d4e5f6.jpg")).toBe(true);
    expect(isMediaKey("../secrets.txt")).toBe(false);
    expect(isMediaKey("projects/../card-photos/x.jpg")).toBe(false);
    expect(isMediaKey("other/x.jpg")).toBe(false);
    expect(isMediaKey("projects/x.svg")).toBe(false);
    expect(mediaUrl("projects/a.webp")).toBe("/media/projects/a.webp");
  });
});

describe("put, get, delete", () => {
  it("round-trips bytes and type, and a missing key reads as null", async () => {
    setMediaStoreForTests(new Files({ adapter: memory() }));
    await putMedia("projects/a-1.webp", Buffer.from([1, 2, 3]), "image/webp");
    expect(await getMedia("projects/a-1.webp")).toEqual({ bytes: Buffer.from([1, 2, 3]), contentType: "image/webp" });
    await deleteMedia("projects/a-1.webp");
    expect(await getMedia("projects/a-1.webp")).toBeNull();
    await expect(deleteMedia("projects/a-1.webp")).resolves.toBeUndefined();
  });

  it("refuses foreign keys and an unconfigured store", async () => {
    setMediaStoreForTests(new Files({ adapter: memory() }));
    await expect(putMedia("../x.jpg", Buffer.from([1]), "image/jpeg")).rejects.toThrow(/Refusing/);
    setMediaStoreForTests(null);
    await expect(putMedia("projects/a.webp", Buffer.from([1]), "image/webp")).rejects.toThrow(/not configured/);
    expect(await getMedia("projects/a.webp")).toBeNull();
  });
});
