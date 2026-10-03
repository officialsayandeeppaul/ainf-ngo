import { beforeEach, describe, expect, it, vi } from "vitest";
import { DonationStatus } from "@prisma/client";

type GiftRow = {
  id: string;
  kind: string;
  missionId: string | null;
  projectId: string | null;
  targetTitle: string;
  amountPaise: number;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  receiptToken: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpayRefundId: string | null;
  status: string;
  receiptEmailedAt: Date | null;
  refundEmailedAt: Date | null;
  paidAt: Date | null;
  refundedAt: Date | null;
};

const h = vi.hoisted(() => {
  const rows = new Map<string, GiftRow>();
  return {
    rows,
    sendReceipt: vi.fn(async () => ({ sent: true })),
    sendRefund: vi.fn(async () => ({ sent: true })),
    createOrder: vi.fn(),
    getPayment: vi.fn(),
    refundPayment: vi.fn(),
  };
});

function matches(row: GiftRow, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  if (where.id === "__none__") return false;
  if (typeof where.id === "string" && where.id !== row.id) return false;
  if (typeof where.razorpayOrderId === "string" && where.razorpayOrderId !== row.razorpayOrderId) return false;
  if (typeof where.razorpayPaymentId === "string" && where.razorpayPaymentId !== row.razorpayPaymentId) return false;
  const status = where.status as { in?: string[] } | string | undefined;
  if (status && typeof status === "object" && status.in && !status.in.includes(row.status)) return false;
  if (typeof status === "string" && status !== row.status) return false;
  if ("receiptEmailedAt" in where && where.receiptEmailedAt === null && row.receiptEmailedAt != null) return false;
  if ("refundEmailedAt" in where && where.refundEmailedAt === null && row.refundEmailedAt != null) return false;
  return true;
}

vi.mock("@/lib/db", () => ({
  db: {
    donation: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return [...h.rows.values()].find((row) => matches(row, where)) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return [...h.rows.values()].find((row) => matches(row, where)) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: GiftRow }) => {
        const nullableDefaults = {
          receiptEmailedAt: null,
          refundEmailedAt: null,
          razorpayOrderId: null,
          razorpayPaymentId: null,
          razorpayRefundId: null,
          paidAt: null,
          refundedAt: null,
        };
        const row: GiftRow = {
          ...nullableDefaults,
          ...data,
          id: data.id ?? `gift_${h.rows.size + 1}`,
        };
        h.rows.set(row.id, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<GiftRow> }) => {
        const row = [...h.rows.values()].find((item) => matches(item, where));
        if (!row) throw new Error("missing");
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<GiftRow> }) => {
        const hits = [...h.rows.values()].filter((item) => matches(item, where));
        hits.forEach((item) => Object.assign(item, data));
        return { count: hits.length };
      }),
    },
    donationSettings: {
      findUnique: vi.fn(async () => ({
        minPaise: 10000,
        maxPaise: 1_000_000,
        suggestedPaise: [50000],
      })),
    },
    donationMission: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        if (where.slug === "shiksha") {
          return { id: "mission_shiksha", slug: "shiksha", title: "Shiksha", published: true, minPaise: null };
        }
        if (where.slug === "hidden") {
          return { id: "mission_hidden", slug: "hidden", title: "Hidden", published: false, minPaise: null };
        }
        return null;
      }),
    },
    fieldProject: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        if (where.slug === "open-project") {
          return { id: "proj_open", slug: "open-project", title: "Open", published: true, acceptDonations: true, donateMinPaise: 25000 };
        }
        if (where.slug === "closed-project") {
          return { id: "proj_closed", slug: "closed-project", title: "Closed", published: true, acceptDonations: false, donateMinPaise: null };
        }
        return null;
      }),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendDonationReceiptEmail: h.sendReceipt,
  sendDonationRefundEmail: h.sendRefund,
}));

vi.mock("@/lib/razorpay", () => ({
  createRazorpayOrder: h.createOrder,
  getRazorpayPayment: h.getPayment,
  refundRazorpayPayment: h.refundPayment,
}));

vi.mock("@/lib/env", () => ({
  absoluteUrl: (path: string) => `http://localhost:3000${path}`,
}));

import { confirmGiftPayment, createGiftOrder, markGiftPaidFromPayment, refundGift } from "@/lib/donations";

const giver = {
  donorName: "Mina Hembrom",
  donorEmail: "mina@example.com",
  donorPhone: "9876543210",
};

beforeEach(() => {
  h.rows.clear();
  h.sendReceipt.mockReset();
  h.sendReceipt.mockResolvedValue({ sent: true });
  h.sendRefund.mockReset();
  h.sendRefund.mockResolvedValue({ sent: true });
  h.createOrder.mockReset();
  h.getPayment.mockReset();
  h.refundPayment.mockReset();
});

describe("gift order", () => {
  it("rejects an amount under the floor before any order is created", async () => {
    const result = await createGiftOrder({ kind: "GENERAL", amountPaise: 100, ...giver });
    expect(result.ok).toBe(false);
    expect(h.createOrder).not.toHaveBeenCalled();
    expect(h.rows.size).toBe(0);
  });

  it("rejects an amount over the cap", async () => {
    const result = await createGiftOrder({ kind: "GENERAL", amountPaise: 2_000_000, ...giver });
    expect(result.ok).toBe(false);
    expect(h.createOrder).not.toHaveBeenCalled();
  });

  it("rejects a hidden mission and a project that is not accepting gifts", async () => {
    const mission = await createGiftOrder({ kind: "MISSION", slug: "hidden", amountPaise: 10000, ...giver });
    const project = await createGiftOrder({ kind: "PROJECT", slug: "closed-project", amountPaise: 25000, ...giver });
    expect(mission.ok).toBe(false);
    expect(project.ok).toBe(false);
    expect(h.rows.size).toBe(0);
  });

  it("uses the project floor when it is higher than the global minimum", async () => {
    const result = await createGiftOrder({ kind: "PROJECT", slug: "open-project", amountPaise: 10000, ...giver });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/minimum/i);
  });

  it("stores the Razorpay order id and marks the gift failed when Razorpay refuses", async () => {
    h.createOrder.mockRejectedValueOnce(new Error("declined"));
    const result = await createGiftOrder({ kind: "MISSION", slug: "shiksha", amountPaise: 10000, ...giver });
    expect(result.ok).toBe(false);
    const row = [...h.rows.values()][0];
    expect(row.status).toBe(DonationStatus.FAILED);
    expect(row.razorpayOrderId).toBeNull();
  });

  it("creates the order for the exact paise amount with a donation note", async () => {
    h.createOrder.mockResolvedValueOnce({ id: "order_1" });
    const result = await createGiftOrder({ kind: "GENERAL", amountPaise: 50000, ...giver });
    expect(result.ok).toBe(true);
    expect(h.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 50000,
        notes: expect.objectContaining({ purpose: "donation" }),
      })
    );
    expect([...h.rows.values()][0].razorpayOrderId).toBe("order_1");
  });
});

describe("gift capture", () => {
  async function seedCreated() {
    h.createOrder.mockResolvedValueOnce({ id: "order_1" });
    await createGiftOrder({ kind: "GENERAL", amountPaise: 50000, ...giver });
  }

  it("marks a matching captured payment paid and emails the receipt once", async () => {
    await seedCreated();
    const first = await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "captured",
    });
    const second = await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "captured",
    });
    expect(first).toMatchObject({ ok: true, deduplicated: false });
    expect(second).toMatchObject({ ok: true, deduplicated: true });
    expect([...h.rows.values()][0].status).toBe(DonationStatus.PAID);
    expect(h.sendReceipt).toHaveBeenCalledTimes(1);
  });

  it("does not mark a mismatched or uncaptured payment paid", async () => {
    await seedCreated();
    const mismatch = await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 100,
      currency: "INR",
      status: "captured",
    });
    const pending = await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "created",
    });
    expect(mismatch.ok).toBe(false);
    expect(pending.ok).toBe(false);
    expect([...h.rows.values()][0].status).toBe(DonationStatus.CREATED);
    expect(h.sendReceipt).not.toHaveBeenCalled();
  });

  it("retries the receipt email when the first send failed", async () => {
    await seedCreated();
    h.sendReceipt.mockResolvedValueOnce({ sent: false });
    await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "captured",
    });
    expect([...h.rows.values()][0].receiptEmailedAt).toBeNull();
    h.sendReceipt.mockResolvedValueOnce({ sent: true });
    await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "captured",
    });
    expect(h.sendReceipt).toHaveBeenCalledTimes(2);
    expect([...h.rows.values()][0].receiptEmailedAt).not.toBeNull();
  });

  it("refuses a signature that does not match and a payment for another order", async () => {
    await seedCreated();
    const badSign = await confirmGiftPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      razorpaySignature: "nope",
      signatureOk: false,
    });
    expect(badSign).toMatchObject({ ok: false, status: 401 });
    expect(h.getPayment).not.toHaveBeenCalled();

    h.getPayment.mockResolvedValueOnce({
      id: "pay_1",
      order_id: "order_other",
      amount: 50000,
      currency: "INR",
      status: "captured",
      captured: true,
    });
    const other = await confirmGiftPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      razorpaySignature: "sig",
      signatureOk: true,
    });
    expect(other.ok).toBe(false);
    expect([...h.rows.values()][0].status).toBe(DonationStatus.CREATED);
  });
});

describe("gift refund", () => {
  it("returns a paid gift once and refuses a second return", async () => {
    h.createOrder.mockResolvedValueOnce({ id: "order_1" });
    await createGiftOrder({ kind: "GENERAL", amountPaise: 50000, ...giver });
    await markGiftPaidFromPayment({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 50000,
      currency: "INR",
      status: "captured",
    });
    const id = [...h.rows.values()][0].id;
    h.refundPayment.mockResolvedValue({ id: "rfnd_1" });
    const first = await refundGift(id);
    const second = await refundGift(id);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(h.refundPayment).toHaveBeenCalledTimes(1);
    expect(h.sendRefund).toHaveBeenCalledTimes(1);
    expect([...h.rows.values()][0].status).toBe(DonationStatus.REFUNDED);
  });

  it("does not call Razorpay for a gift that was never paid", async () => {
    h.createOrder.mockResolvedValueOnce({ id: "order_1" });
    await createGiftOrder({ kind: "GENERAL", amountPaise: 50000, ...giver });
    const result = await refundGift([...h.rows.values()][0].id);
    expect(result.ok).toBe(false);
    expect(h.refundPayment).not.toHaveBeenCalled();
  });
});
