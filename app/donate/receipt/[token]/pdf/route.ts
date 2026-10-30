import { receiptMissingHtml } from "@/lib/donate-document";
import { buildReceiptPdf, receiptPdfFilename } from "@/lib/receipt-pdf";
import { loadReceiptView } from "@/lib/receipt-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

/** The receipt as a locked PDF with a clickable "Verify this payment" link. */
export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const view = await loadReceiptView(token);
  if (!view) {
    return new Response(receiptMissingHtml(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const pdf = await buildReceiptPdf(view);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${receiptPdfFilename(view)}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
