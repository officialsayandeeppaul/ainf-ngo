import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";

export type ReceiptSealPayload = {
  v: 1;
  id: string;
  paise: number;
  name: string;
  email: string;
  phone: string;
  target: string;
  status: "PAID" | "REFUNDED";
  paymentId: string;
  refundId: string;
  at: string;
};

export type GiftSealSource = {
  id: string;
  amountPaise: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  targetTitle: string;
  status: "PAID" | "REFUNDED";
  razorpayPaymentId: string | null;
  razorpayRefundId: string | null;
  at: Date;
};

/** Key stays on the server. The printed code is ciphertext, not a readable signature. */
export function receiptSealSecret(): string | null {
  const secret = env.RAZORPAY_KEY_SECRET?.trim();
  return secret || null;
}

export function receiptSealKey(secret: string): Buffer {
  return createHash("sha256").update(`ainf-receipt-v1\0${secret}`, "utf8").digest();
}

export function giftSealPayload(row: GiftSealSource): ReceiptSealPayload | null {
  if (!row.razorpayPaymentId) return null;
  return {
    v: 1,
    id: row.id,
    paise: row.amountPaise,
    name: row.donorName,
    email: row.donorEmail,
    phone: row.donorPhone,
    target: row.targetTitle,
    status: row.status,
    paymentId: row.razorpayPaymentId,
    refundId: row.razorpayRefundId || "",
    at: row.at.toISOString(),
  };
}

export function sealReceipt(payload: ReceiptSealPayload, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", receiptSealKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openReceiptSeal(seal: string, secret: string): ReceiptSealPayload | null {
  try {
    const compact = seal.replace(/\s+/g, "");
    const raw = Buffer.from(compact, "base64url");
    if (raw.length < 12 + 16 + 2) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", receiptSealKey(secret), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(plain) as Partial<ReceiptSealPayload>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.id !== "string" || typeof parsed.paise !== "number" || !Number.isInteger(parsed.paise)) return null;
    if (parsed.status !== "PAID" && parsed.status !== "REFUNDED") return null;
    if (typeof parsed.paymentId !== "string" || !parsed.paymentId) return null;
    if (typeof parsed.name !== "string" || typeof parsed.email !== "string" || typeof parsed.phone !== "string") return null;
    if (typeof parsed.target !== "string" || typeof parsed.at !== "string" || typeof parsed.refundId !== "string") return null;
    return parsed as ReceiptSealPayload;
  } catch {
    return null;
  }
}

export function sealMatchesGift(opened: ReceiptSealPayload, row: GiftSealSource): boolean {
  return (
    opened.id === row.id &&
    opened.paise === row.amountPaise &&
    opened.name === row.donorName &&
    opened.email === row.donorEmail &&
    opened.phone === row.donorPhone &&
    opened.target === row.targetTitle &&
    opened.status === row.status &&
    opened.paymentId === (row.razorpayPaymentId || "") &&
    opened.refundId === (row.razorpayRefundId || "") &&
    opened.at === row.at.toISOString()
  );
}

export function formatSeal(seal: string): string {
  return seal.replace(/(.{4})/g, "$1 ").trim();
}
