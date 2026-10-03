import { receiptLookupHtml } from "@/lib/donate-document";

export const dynamic = "force-dynamic";

/** Guest receipt recovery form. The token receipt lives at /donate/receipt/[token]. */
export async function GET() {
  return new Response(receiptLookupHtml(), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
