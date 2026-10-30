import { DonationStatus } from "@prisma/client";
import { db } from "./db";
import { env, isDatabaseConfigured } from "./env";
import { formatDayTime } from "./format-date";
import { formatInr } from "./membership";
import {
  formatSeal,
  giftSealPayload,
  openReceiptSeal,
  receiptSealSecret,
  sealMatchesGift,
  sealReceipt,
  type GiftSealSource,
} from "./receipt-seal";

/** Everything a donation receipt shows, for the web page and the PDF alike. */
export type ReceiptView = {
  token: string;
  name: string;
  email: string;
  phone: string;
  amountPaise: number;
  amount: string;
  target: string;
  when: string;
  status: string;
  paymentId: string;
  refundId: string;
  returned: boolean;
  emailed: boolean;
  verified: boolean;
  /** Grouped seal for display; empty unless verified. */
  seal: string;
  /** Opens /donate/verify with this receipt's seal; empty unless verified. */
  verifyUrl: string;
};

export const RECEIPT_TOKEN = /^[A-Za-z0-9_-]{20,120}$/;

const STATUS_LABEL: Record<DonationStatus, string> = {
  CREATED: "Not paid",
  PAID: "Received",
  FAILED: "Not taken",
  REFUNDED: "Returned",
};

/** A paid or returned donation's receipt, or null when the token shows nothing. */
export async function loadReceiptView(token: string): Promise<ReceiptView | null> {
  if (!RECEIPT_TOKEN.test(token) || !isDatabaseConfigured) return null;
  const row = await db.donation.findUnique({ where: { receiptToken: token } });
  if (!row || row.status === DonationStatus.CREATED || row.status === DonationStatus.FAILED) return null;

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

  return {
    token,
    name: row.donorName,
    email: row.donorEmail,
    phone: row.donorPhone,
    amountPaise: row.amountPaise,
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
  };
}
