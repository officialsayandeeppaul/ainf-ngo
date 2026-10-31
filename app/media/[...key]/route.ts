import { getMedia, isMediaKey } from "@/lib/object-storage";

export const runtime = "nodejs";

/**
 * Public site photos from Neon Object Storage (admin project uploads). Every
 * upload gets a new key, so the response is cached for a year at the CDN and in
 * browsers and the bucket is read about once per photo. Card photos share the
 * bucket but are private: only `projects/` is served here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!key.startsWith("projects/") || !isMediaKey(key)) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  }
  let media: Awaited<ReturnType<typeof getMedia>>;
  try {
    media = await getMedia(key);
  } catch (error) {
    console.error("[media] read failed", error);
    return new Response("Unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!media) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=300" } });
  }
  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "content-type": media.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
