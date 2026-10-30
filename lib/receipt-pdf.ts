import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { qrModules } from "./membership-card-art";
import { NON_REFUNDABLE_RECEIPT } from "./payment-policy";
import type { ReceiptView } from "./receipt-view";

/**
 * The donation receipt as a downloadable PDF.
 *
 * Locked: AES-256 with a random owner password nobody keeps, so it opens
 * without a password and prints, but editing, form filling, annotating and
 * page assembly are refused. The "Verify this payment" line and the QR are
 * real links to the seal check on theainf.in.
 */

/**
 * Onest, the site face, as TTF: fontkit cannot subset WOFF2 for embedding, so
 * these are the site's two Onest files decompressed (OFL, see lib/fonts/OFL.txt).
 */
const FONT_DIR = path.join(process.cwd(), "lib", "fonts");
export const RECEIPT_PDF_FONTS = {
  text: "Onest-Regular.ttf",
  textBold: "Onest-Bold.ttf",
} as const;

let fontCache: Record<keyof typeof RECEIPT_PDF_FONTS, Buffer> | null = null;

function fonts() {
  if (!fontCache) {
    fontCache = {
      text: readFileSync(path.join(FONT_DIR, RECEIPT_PDF_FONTS.text)),
      textBold: readFileSync(path.join(FONT_DIR, RECEIPT_PDF_FONTS.textBold)),
    };
  }
  return fontCache;
}

/**
 * Onest has no ₹ and fontkit cannot shape the site's Inter files, so the sign
 * is drawn from Inter SemiBold's own outline (2048 units/em, 1490 tall,
 * 1150 advance), scaled to Onest's cap height — the same sign browsers show.
 */
const RUPEE_PATH =
  "M1084 1127L1031 935L876 935Q853 791 750.5 697.5Q648 604 449 580L440 578L900 13L900 0L600 0L90 613L88 774L342 774Q449 774 516 817Q583 860 606 935L67 935L120 1127L599 1127Q574 1192 510.5 1229Q447 1266 342 1266L67 1266L124 1490L1084 1490L1031 1296L810 1297Q861 1224 877 1127Z";
const RUPEE_HEIGHT = 1490;
const RUPEE_ADVANCE = 1150;
const ONEST_CAP_HEIGHT = 0.708;

/** Writes an amount like "₹2,500" with its baseline at `baseline`. */
function drawAmount(doc: PDFKit.PDFDocument, amount: string, x: number, baseline: number, size: number, color: string) {
  let cursor = x;
  let digits = amount;
  if (digits.startsWith("₹")) {
    const scale = (ONEST_CAP_HEIGHT * size) / RUPEE_HEIGHT;
    doc.save().translate(cursor, baseline).scale(scale, -scale).path(RUPEE_PATH).fill(color).restore();
    cursor += RUPEE_ADVANCE * scale + size * 0.04;
    digits = digits.slice(1);
  }
  doc.font("bold").fontSize(size).fillColor(color).text(digits, cursor, baseline, { baseline: "alphabetic", lineBreak: false });
}

const GREEN = "#1c7d48";
const INK = "#1a1d1b";
const MUTED = "#5c6b64";
const FAINT = "#8a938d";
const LINE = "#e2e7e4";
const SOFT = "#f3faf6";
const AMBER = "#9a5b13";
const AMBER_SOFT = "#fdf5e8";

export function receiptPdfFilename(view: Pick<ReceiptView, "paymentId">): string {
  const ref = view.paymentId.replace(/[^A-Za-z0-9_-]/g, "").slice(-18) || "receipt";
  return `AINF-donation-receipt-${ref}.pdf`;
}

export async function buildReceiptPdf(view: ReceiptView, now: Date = new Date()): Promise<Buffer> {
  const font = fonts();
  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    font: font.text as unknown as string,
    pdfVersion: "1.7ext3",
    ownerPassword: randomBytes(24).toString("hex"),
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: true,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
    info: {
      Title: `AINF donation receipt — ${view.amount}`,
      Author: "All Indian Nevarlands Foundation",
      Subject: `Donation for ${view.target}`,
      Creator: "theainf.in",
      Producer: "theainf.in",
      CreationDate: now,
    },
  });
  doc.registerFont("text", font.text);
  doc.registerFont("bold", font.textBold);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  let y = doc.page.margins.top;

  // Masthead
  doc.font("bold").fontSize(15).fillColor(GREEN).text("AINF", left, y);
  doc
    .font("text")
    .fontSize(9.5)
    .fillColor(FAINT)
    .text("All Indian Nevarlands Foundation · Nala, Jamtara, Jharkhand", left, y + 3, { width, align: "right" });
  y += 30;
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1).strokeColor(LINE).stroke();
  y += 22;

  // Status and title
  const statusText = view.returned ? "Returned" : view.verified ? "Verified payment" : view.status;
  const pillWidth = doc.font("bold").fontSize(9).widthOfString(statusText) + 20;
  doc.roundedRect(left, y, pillWidth, 20, 10).fill(view.returned ? AMBER_SOFT : SOFT);
  doc.fillColor(view.returned ? AMBER : GREEN).text(statusText, left, y + 5.5, { width: pillWidth, align: "center" });
  y += 34;
  doc
    .font("text")
    .fontSize(24)
    .fillColor(INK)
    .text(view.returned ? "Donation returned" : "Donation receipt", left, y, { width });
  y = doc.y + 6;
  const who = view.name.trim() || "friend";
  const lead = view.returned
    ? `The donation from ${who} for ${view.target} has been returned in full.`
    : `Thank you, ${who}. Your donation for ${view.target} is received.`;
  doc.font("text").fontSize(11.5).fillColor(MUTED).text(lead, left, y, { width, lineGap: 2 });
  y = doc.y + 18;

  // Amount
  doc.roundedRect(left, y, width, 74, 12).fill(SOFT);
  doc.font("text").fontSize(10).fillColor(MUTED).text("Amount (INR)", left + 18, y + 15);
  drawAmount(doc, view.amount, left + 18, y + 58, 26, INK);
  y += 92;

  // Details
  const rows: Array<[string, string]> = [
    ["Full name", view.name],
    ["Email ID", view.email],
    ["Phone", view.phone],
    ["Donated to", view.target],
    ["When", `${view.when} (India time)`],
    ["Status", view.status],
    ["Payment reference", view.paymentId],
  ];
  if (view.refundId) rows.push(["Return reference", view.refundId]);
  const labelWidth = 140;
  for (const [label, value] of rows) {
    doc.font("text").fontSize(10).fillColor(FAINT).text(label, left, y, { width: labelWidth });
    doc.font("text").fontSize(11).fillColor(INK).text(value || "—", left + labelWidth, y - 0.5, {
      width: width - labelWidth,
    });
    y = Math.max(doc.y, y + 14) + 9;
    doc.moveTo(left, y - 5).lineTo(left + width, y - 5).lineWidth(0.6).strokeColor(LINE).stroke();
  }
  y += 10;

  // Policy
  if (!view.returned) {
    doc.font("text").fontSize(9.5);
    const policyHeight = doc.heightOfString(NON_REFUNDABLE_RECEIPT, { width: width - 28 }) + 20;
    doc.roundedRect(left, y, width, policyHeight, 10).fill(AMBER_SOFT);
    doc.fillColor(AMBER).text(NON_REFUNDABLE_RECEIPT, left + 14, y + 10, { width: width - 28 });
    y += policyHeight + 18;
  }

  // Verify: a QR and a clickable link to the seal check.
  if (view.verifyUrl) {
    // The seal makes the URL long, so the QR is dense; 124pt (~44 mm) keeps
    // each module big enough to scan from paper.
    const qrSize = 124;
    const { size, darkAt } = qrModules(view.verifyUrl);
    // A 4-module quiet zone inside the box, and each row's dark modules drawn
    // as one run, so no hairline seams split the code when it is rendered.
    const quiet = 4;
    const cell = qrSize / (size + quiet * 2);
    doc.rect(left, y, qrSize, qrSize).fill("#ffffff");
    for (let row = 0; row < size; row += 1) {
      let col = 0;
      while (col < size) {
        if (!darkAt(col, row)) {
          col += 1;
          continue;
        }
        const start = col;
        while (col < size && darkAt(col, row)) col += 1;
        doc.rect(left + (quiet + start) * cell, y + (quiet + row) * cell, (col - start) * cell, cell + 0.05).fill(INK);
      }
    }
    doc.link(left, y, qrSize, qrSize, view.verifyUrl);
    const textLeft = left + qrSize + 18;
    const textWidth = width - qrSize - 18;
    doc
      .font("bold")
      .fontSize(13)
      .fillColor(GREEN)
      .text("Verify this payment", textLeft, y + 2, { width: textWidth, link: view.verifyUrl, underline: true });
    doc
      .font("text")
      .fontSize(10)
      .fillColor(MUTED)
      .text(
        "Click the line above or scan the code. It opens theainf.in and checks this receipt's seal against the donation on record.",
        textLeft,
        doc.y + 4,
        { width: textWidth, lineGap: 1.5 }
      );
    // A short, readable label; the link itself carries the full sealed URL.
    const host = (() => {
      try {
        return `${new URL(view.verifyUrl).host}/donate/verify`;
      } catch {
        return "theainf.in/donate/verify";
      }
    })();
    doc
      .font("text")
      .fontSize(9.5)
      .fillColor(GREEN)
      .text(host, textLeft, doc.y + 8, { width: textWidth, link: view.verifyUrl });
    y = Math.max(y + qrSize, doc.y) + 22;
  }

  // Footer
  doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.6).strokeColor(LINE).stroke();
  doc
    .font("text")
    .fontSize(8.5)
    .fillColor(FAINT)
    .text(
      "This is a record of your donation, not a tax certificate, and not a Field Sevak membership. " +
        "This PDF is locked against editing; anyone can confirm it with the verify link. " +
        "hello@theainf.in · theainf.in",
      left,
      y + 10,
      { width, lineGap: 1.5 }
    );

  doc.end();
  return done;
}
