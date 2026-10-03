import { getPublicSupportBanner } from "@/lib/support-banner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public read of the live support campaign (no auth). */
export async function GET() {
  const banner = await getPublicSupportBanner();
  return Response.json(
    { banner },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
