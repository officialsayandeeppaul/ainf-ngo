import { DonationStatus } from "@prisma/client";
import { receiptVerifyHtml } from "@/lib/donate-document";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import {
  openReceiptSeal,
  receiptSealSecret,
  sealMatchesGift,
  type GiftSealSource,
} from "@/lib/receipt-seal";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<"PAID" | "REFUNDED", string> = {
  PAID: "Received",
  REFUNDED: "Returned",
};

function page(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const seal = new URL(request.url).searchParams.get("seal")?.trim() || "";
  if (!seal) {
    return page(receiptVerifyHtml({ state: "empty", seal: "", lines: [] }));
  }
  const secret = receiptSealSecret();
  const opened = secret ? openReceiptSeal(seal, secret) : null;
  if (!opened || !isDatabaseConfigured) {
    return page(receiptVerifyHtml({ state: "invalid", seal, lines: [] }), 400);
  }

  const row = await db.donation.findUnique({ where: { id: opened.id } });
  if (!row || (row.status !== DonationStatus.PAID && row.status !== DonationStatus.REFUNDED)) {
    return page(receiptVerifyHtml({ state: "mismatch", seal, lines: decodedLines(opened) }), 409);
  }

  const when = row.refundedAt ?? row.paidAt ?? row.createdAt;
  const source: GiftSealSource = {
    id: row.id,
    amountPaise: row.amountPaise,
    donorName: row.donorName,
    donorEmail: row.donorEmail,
    donorPhone: row.donorPhone,
    targetTitle: row.targetTitle,
    status: row.status === DonationStatus.REFUNDED ? "REFUNDED" : "PAID",
    razorpayPaymentId: row.razorpayPaymentId,
    razorpayRefundId: row.razorpayRefundId,
    at: when,
  };
  const lines = [
    { label: "Amount (INR)", value: formatInr(opened.paise) },
    { label: "Full Name", value: opened.name },
    { label: "Email ID", value: opened.email },
    { label: "Phone", value: opened.phone },
    { label: "Desk / Vertical", value: opened.target },
    { label: "When", value: formatDayTime(new Date(opened.at)) },
    { label: "Status", value: STATUS_LABEL[opened.status] },
    { label: "Payment reference", value: opened.paymentId },
    ...(opened.refundId ? [{ label: "Return reference", value: opened.refundId }] : []),
  ];

  if (sealMatchesGift(opened, source)) {
    return page(
      receiptVerifyHtml({ state: source.status === "REFUNDED" ? "returned" : "verified", seal, lines })
    );
  }

  const laterReturned =
    opened.status === "PAID" &&
    source.status === "REFUNDED" &&
    opened.id === row.id &&
    opened.paise === row.amountPaise &&
    opened.paymentId === row.razorpayPaymentId &&
    opened.email === row.donorEmail;

  if (laterReturned) {
    return page(receiptVerifyHtml({ state: "returned", seal, lines }));
  }

  return page(receiptVerifyHtml({ state: "mismatch", seal, lines }), 409);
}

function decodedLines(opened: NonNullable<ReturnType<typeof openReceiptSeal>>) {
  return [
    { label: "Amount (INR)", value: formatInr(opened.paise) },
    { label: "Full Name", value: opened.name },
    { label: "Payment reference", value: opened.paymentId },
  ];
}
