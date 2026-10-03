import { createHmac, timingSafeEqual } from "node:crypto";
import { env, requireRazorpayEnv } from "./env";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authHeader(): string {
  const { NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = requireRazorpayEnv();
  return `Basic ${Buffer.from(`${NEXT_PUBLIC_RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
      payment_capture: 1,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as RazorpayOrder & {
    error?: { description?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.description ?? `Razorpay order failed (${response.status}).`);
  }
  return payload;
}

export async function razorpayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
    headers: {
      Authorization: authHeader(),
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { description?: string; code?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.description ?? `Razorpay ${path} failed (${response.status}).`);
  }
  return payload;
}

export async function createRazorpayPlan(input: {
  name: string;
  amountPaise: number;
  period: "monthly" | "yearly";
}): Promise<{ id: string }> {
  return razorpayFetch("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: input.period,
      interval: 1,
      item: {
        name: input.name.slice(0, 255),
        amount: input.amountPaise,
        currency: "INR",
      },
    }),
  });
}

export async function createRazorpaySubscription(input: {
  planId: string;
  notes: Record<string, string>;
  startAt?: number;
}): Promise<{ id: string; status: string }> {
  return razorpayFetch("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: input.planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: input.notes,
      ...(input.startAt ? { start_at: input.startAt } : {}),
    }),
  });
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  atCycleEnd: boolean
): Promise<void> {
  await razorpayFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

export type RazorpayPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  email: string | null;
  contact: string | null;
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string | null;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
  notes?: Record<string, string> | null;
};

/** Full refund of a captured payment. Amount is in paise. */
export async function refundRazorpayPayment(
  paymentId: string,
  amountPaise: number
): Promise<{ id: string }> {
  return razorpayFetch<{ id: string }>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount: amountPaise }),
  });
}

/** Live payment object from Razorpay — useful for admin testing / dispute checks. */
export async function getRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** Dashboard deep-link for a payment (works in test and live mode once signed in). */
export function razorpayPaymentDashboardUrl(paymentId: string): string {
  return `https://dashboard.razorpay.com/app/payments/${encodeURIComponent(paymentId)}`;
}

/** Subscription checkout: HMAC_SHA256(payment_id + "|" + subscription_id, key_secret). */
export function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string
): boolean {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret || !paymentId || !subscriptionId || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** Checkout.js callback: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

/** Dashboard webhook: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | null): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
