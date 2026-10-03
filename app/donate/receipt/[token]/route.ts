import { DonationStatus } from "@prisma/client";
import { receiptMissingHtml, receiptPageHtml } from "@/lib/donate-document";
import { db } from "@/lib/db";
import { env, isDatabaseConfigured } from "@/lib/env";
import { formatDayTime } from "@/lib/format-date";
import { formatInr } from "@/lib/membership";
import {
  formatSeal,
  giftSealPayload,
  openReceiptSeal,
  receiptSealSecret,
  sealMatchesGift,
  sealReceipt,
  type GiftSealSource,
} from "@/lib/receipt-seal";

export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{20,120}$/;

const STATUS_LABEL: Record<DonationStatus, string> = {
  CREATED: "Not paid",
  PAID: "Received",
  FAILED: "Not taken",
  REFUNDED: "Returned",
};

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!TOKEN.test(token) || !isDatabaseConfigured) {
    return new Response(receiptMissingHtml(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const row = await db.donation.findUnique({ where: { receiptToken: token } });
  if (!row || row.status === DonationStatus.CREATED || row.status === DonationStatus.FAILED) {
    return new Response(receiptMissingHtml(), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
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
  const secret = receiptSealSecret();
  const payload = secret ? giftSealPayload(source) : null;
  const rawSeal = payload && secret ? sealReceipt(payload, secret) : "";
  const opened = rawSeal && secret ? openReceiptSeal(rawSeal, secret) : null;
  const verified = Boolean(opened && sealMatchesGift(opened, source));
  return new Response(
    receiptPageHtml({
      name: row.donorName,
      email: row.donorEmail,
      phone: row.donorPhone,
      amount: formatInr(row.amountPaise),
      target: row.targetTitle,
      when: formatDayTime(when),
      status: STATUS_LABEL[row.status],
      paymentId: row.razorpayPaymentId || row.id,
      refundId: row.razorpayRefundId || "",
      returned: row.status === DonationStatus.REFUNDED,
      emailed: Boolean(row.receiptEmailedAt),
      verified,
      seal: verified ? formatSeal(rawSeal) : "",
      verifyUrl: verified ? `${env.NEXT_PUBLIC_APP_URL}/donate/verify?seal=${encodeURIComponent(rawSeal)}` : "",
    }),
    {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    }
  );
}
