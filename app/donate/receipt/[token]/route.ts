import { receiptMissingHtml, receiptPageHtml } from "@/lib/donate-document";
import { loadReceiptView } from "@/lib/receipt-view";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const view = await loadReceiptView(token);
  if (!view) {
    return new Response(receiptMissingHtml(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(receiptPageHtml(view), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
