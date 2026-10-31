import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { userId: string; bytes: Uint8Array | null; storageKey: string | null; mime: string; updatedAt: Date };

const h = vi.hoisted(() => ({ rows: new Map<string, Row>() }));

vi.mock("@/lib/db", () => ({
  db: {
    cardPhoto: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => h.rows.get(where.userId) ?? null),
      upsert: vi.fn(
        async ({ where, create, update }: { where: { userId: string }; create: Partial<Row>; update: Partial<Row> }) => {
          const now = new Date();
          const prev = h.rows.get(where.userId);
          const next = prev
            ? { ...prev, ...update, updatedAt: now }
            : ({ bytes: null, storageKey: null, mime: "image/jpeg", ...create, userId: where.userId, updatedAt: now } as Row);
          h.rows.set(where.userId, next);
          return { updatedAt: now };
        }
      ),
    },
  },
}));

import { Files } from "files-sdk";
import { memory } from "files-sdk/memory";
import { cardPhotoDataUri, loadCardPhoto, saveCardPhoto } from "@/lib/card-photo";
import { getMedia, setMediaStoreForTests } from "@/lib/object-storage";

const jpeg = (n: number) => Buffer.from([0xff, 0xd8, n, 0xff, 0xd9]);

beforeEach(() => h.rows.clear());
afterEach(() => setMediaStoreForTests(undefined));

describe("card photos with object storage", () => {
  it("stores the file in the bucket and only the key in Postgres", async () => {
    setMediaStoreForTests(new Files({ adapter: memory() }));
    await saveCardPhoto("u1", jpeg(1));
    const row = h.rows.get("u1")!;
    expect(row.bytes).toBeNull();
    expect(row.storageKey).toMatch(/^card-photos\/u1\/[a-z0-9]+-[0-9a-f]{12}\.jpg$/);
    expect((await getMedia(row.storageKey!))?.bytes).toEqual(jpeg(1));
    expect((await loadCardPhoto("u1"))?.bytes).toEqual(jpeg(1));
    expect(await cardPhotoDataUri("u1")).toBe(`data:image/jpeg;base64,${jpeg(1).toString("base64")}`);
  });

  it("a new photo gets a new key and the old file is deleted", async () => {
    setMediaStoreForTests(new Files({ adapter: memory() }));
    await saveCardPhoto("u1", jpeg(1));
    const first = h.rows.get("u1")!.storageKey!;
    await saveCardPhoto("u1", jpeg(2));
    const second = h.rows.get("u1")!.storageKey!;
    expect(second).not.toBe(first);
    expect(await getMedia(first)).toBeNull();
    expect((await loadCardPhoto("u1"))?.bytes).toEqual(jpeg(2));
  });

  it("still reads photos saved in Postgres before the bucket existed", async () => {
    setMediaStoreForTests(new Files({ adapter: memory() }));
    h.rows.set("old", { userId: "old", bytes: new Uint8Array(jpeg(7)), storageKey: null, mime: "image/jpeg", updatedAt: new Date() });
    expect((await loadCardPhoto("old"))?.bytes).toEqual(jpeg(7));
  });

  it("keeps the bytes in Postgres when storage is not configured", async () => {
    setMediaStoreForTests(null);
    await saveCardPhoto("u2", jpeg(3));
    const row = h.rows.get("u2")!;
    expect(row.storageKey).toBeNull();
    expect(Buffer.from(row.bytes!)).toEqual(jpeg(3));
    expect((await loadCardPhoto("u2"))?.bytes).toEqual(jpeg(3));
  });
});
