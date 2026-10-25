import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipChangeKind } from "@prisma/client";

type Row = Record<string, unknown> & { id: string };

const h = vi.hoisted(() => {
  const tables = {
    paymentInterest: new Map<string, Row>(),
    paymentLink: new Map<string, Row>(),
    donation: new Map<string, Row>(),
    membershipOrder: new Map<string, Row>(),
    user: new Map<string, Row>(),
    membershipTier: new Map<string, Row>(),
  };
  return {
    tables,
    createLink: vi.fn(),
    fetchLink: vi.fn(),
    cancelLink: vi.fn(),
    notifyLink: vi.fn(),
    getPayment: vi.fn(),
    keyHealth: vi.fn(async () => "ok"),
    markGift: vi.fn(),
    markOrder: vi.fn(),
    email: vi.fn(async () => ({ sent: true })),
    audit: vi.fn(async () => {}),
  };
});

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key] ?? null;
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; in?: unknown[] };
      if ("not" in c) return value !== c.not;
      if ("in" in c) return (c.in ?? []).includes(value);
      return true;
    }
    return value === cond;
  });
}

function table(name: keyof typeof h.tables, defaults: Record<string, unknown> = {}) {
  const rows = h.tables[name];
  return {
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const hit = [...rows.values()].find((row) => matches(row, where));
      return hit ? { ...hit } : null;
    }),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const hit = [...rows.values()].find((row) => matches(row, where));
      return hit ? { ...hit } : null;
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...defaults, id: `${name}_${rows.size + 1}`, createdAt: new Date(), ...data } as Row;
      rows.set(row.id, row);
      return { ...row };
    }),
    update: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = [...rows.values()].find((item) => matches(item, where));
      if (!row) throw new Error(`${name} missing`);
      Object.assign(row, data);
      return { ...row };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = [...rows.values()].filter((item) => matches(item, where));
      hits.forEach((item) => Object.assign(item, data));
      return { count: hits.length };
    }),
  };
}

vi.mock("@/lib/db", () => {
  const interest = table("paymentInterest");
  const findInterest = interest.findUnique;
  return {
    db: {
      paymentInterest: {
        ...interest,
        findUnique: vi.fn(async (args: { where: Record<string, unknown>; include?: unknown }) => {
          const row = await findInterest(args);
          if (!row || !args.include) return row;
          return {
            ...row,
            tier: row.tierId ? (h.tables.membershipTier.get(row.tierId as string) ?? null) : null,
            links: [...h.tables.paymentLink.values()].filter(
              (link) => link.interestId === row.id && link.status === "CREATED"
            ),
          };
        }),
      },
      paymentLink: table("paymentLink", {
        status: "CREATED",
        razorpayLinkId: null,
        shortUrl: null,
        razorpayPaymentId: null,
        razorpayOrderId: null,
        donationId: null,
        membershipOrderId: null,
        emailedAt: null,
        lastError: null,
        paidAt: null,
      }),
      donation: table("donation", { razorpayOrderId: null }),
      membershipOrder: table("membershipOrder", { status: "CREATED", razorpayOrderId: null }),
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const user = h.tables.user.get(where.id);
          if (!user) return null;
          const tier = user.membershipTierId ? h.tables.membershipTier.get(user.membershipTierId as string) : null;
          return { ...user, membershipTier: tier ?? null };
        }),
      },
    },
  };
});

vi.mock("@/lib/razorpay", async () => {
  const actual = await vi.importActual<typeof import("@/lib/razorpay")>("@/lib/razorpay");
  return {
    ...actual,
    createRazorpayPaymentLink: h.createLink,
    fetchRazorpayPaymentLink: h.fetchLink,
    cancelRazorpayPaymentLink: h.cancelLink,
    notifyRazorpayPaymentLink: h.notifyLink,
    getRazorpayPayment: h.getPayment,
    checkRazorpayKeys: h.keyHealth,
  };
});

vi.mock("@/lib/donations", () => ({
  getGiftSettings: vi.fn(async () => ({ minPaise: 10000, maxPaise: 1_000_000, suggestedPaise: [] })),
  resolveGiftTarget: vi.fn(async () => ({
    ok: true,
    kind: "MISSION",
    missionId: "mission_shiksha",
    projectId: null,
    title: "Shiksha",
    floor: 10000,
  })),
  newReceiptToken: () => "receipt_token",
  markGiftPaidFromPayment: h.markGift,
}));

vi.mock("@/lib/membership-pay", () => ({ markOrderPaid: h.markOrder }));
vi.mock("@/lib/email", () => ({ sendPaymentLinkEmail: h.email, sendPaymentInterestEmail: h.email }));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

import {
  cancelPaymentLink,
  createLinkForInterest,
  handlePaymentLinkEvent,
  linkExpiry,
  membershipChangeFor,
  normalizeIndianContact,
  settlePaymentLink,
} from "@/lib/payment-links";
import { verifyPaymentLinkSignature } from "@/lib/razorpay";

const actor = { userId: "admin_1", clerkId: "clerk_admin", role: "SUPER_ADMIN" as const };

function seedGiftInterest(overrides: Record<string, unknown> = {}) {
  const row: Row = {
    id: "int_gift",
    purpose: "DONATION",
    status: "OPEN",
    userId: null,
    name: "Mina Hembrom",
    email: "mina@example.com",
    phone: "98765 43210",
    amountPaise: 50000,
    donationKind: "MISSION",
    targetSlug: "shiksha",
    targetTitle: "Shiksha",
    tierId: null,
    interval: null,
    ...overrides,
  };
  h.tables.paymentInterest.set(row.id, row);
  return row;
}

function seedMembershipInterest() {
  h.tables.membershipTier.set("tier_sevak", { id: "tier_sevak", name: "Field Sevak", monthlyPaise: 9900 });
  h.tables.user.set("user_1", { id: "user_1", membershipTierId: null, membershipExpiresAt: null });
  const row: Row = {
    id: "int_plan",
    purpose: "MEMBERSHIP",
    status: "OPEN",
    userId: "user_1",
    name: "Ravi Soren",
    email: "ravi@example.com",
    phone: null,
    amountPaise: 9900,
    donationKind: null,
    targetSlug: null,
    targetTitle: "Field Sevak",
    tierId: "tier_sevak",
    interval: "MONTHLY",
  };
  h.tables.paymentInterest.set(row.id, row);
  return row;
}

const linkInput = {
  amountPaise: 50000,
  expiresInDays: 7,
  notifySms: true,
  notifyEmail: false,
  sendAinfEmail: true,
  actor,
};

beforeEach(() => {
  Object.values(h.tables).forEach((rows) => rows.clear());
  [h.createLink, h.fetchLink, h.cancelLink, h.notifyLink, h.getPayment, h.markGift, h.markOrder].forEach((fn) =>
    fn.mockReset()
  );
  h.email.mockClear();
  h.audit.mockClear();
  h.createLink.mockResolvedValue({ id: "plink_1", short_url: "https://rzp.io/i/abc", expire_by: null });
  h.markGift.mockResolvedValue({ ok: true, receiptPath: "/donate/receipt/receipt_token", deduplicated: false });
  h.markOrder.mockResolvedValue({ ok: true, deduplicated: false });
});

describe("helpers", () => {
  it("normalises Indian mobiles to E.164 and drops anything unusable", () => {
    expect(normalizeIndianContact("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianContact("+91 98765-43210")).toBe("+919876543210");
    expect(normalizeIndianContact("919876543210")).toBe("+919876543210");
    expect(normalizeIndianContact("12345")).toBeNull();
    expect(normalizeIndianContact("0123456789")).toBeNull();
    expect(normalizeIndianContact(null)).toBeNull();
  });

  it("only allows the offered link lifetimes", () => {
    const now = new Date("2026-10-25T00:00:00Z");
    expect(linkExpiry(3, now).toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(linkExpiry(999, now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("classifies the plan change a link will make", () => {
    const base = { currentMonthlyPaise: 9900, nextTierId: "b", nextMonthlyPaise: 19900 };
    expect(membershipChangeFor({ ...base, live: false, currentTierId: null })).toEqual({
      changeKind: MembershipChangeKind.NEW,
      restartTerm: false,
    });
    expect(membershipChangeFor({ ...base, live: true, currentTierId: "b" }).changeKind).toBe(MembershipChangeKind.RENEWAL);
    expect(membershipChangeFor({ ...base, live: true, currentTierId: "a" })).toEqual({
      changeKind: MembershipChangeKind.UPGRADE,
      restartTerm: true,
    });
  });

  it("verifies the signed redirect Razorpay sends after a link payment", () => {
    const parts = { linkId: "plink_1", referenceId: "paymentLink_1", status: "paid", paymentId: "pay_1" };
    const signature = createHmac("sha256", "test_razorpay_key_secret")
      .update(`${parts.linkId}|${parts.referenceId}|${parts.status}|${parts.paymentId}`)
      .digest("hex");
    expect(verifyPaymentLinkSignature({ ...parts, signature })).toBe(true);
    expect(verifyPaymentLinkSignature({ ...parts, status: "cancelled", signature })).toBe(false);
  });
});

describe("creating a link", () => {
  it("creates the gift row, the link, and marks the interest sent", async () => {
    seedGiftInterest();
    const result = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const gift = [...h.tables.donation.values()][0];
    expect(gift).toMatchObject({ status: "CREATED", amountPaise: 50000, missionId: "mission_shiksha", donorEmail: "mina@example.com" });
    expect(result.link).toMatchObject({
      razorpayLinkId: "plink_1",
      shortUrl: "https://rzp.io/i/abc",
      donationId: gift.id,
      customerPhone: "+919876543210",
      notifySms: true,
    });
    expect(h.createLink).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 50000,
        referenceId: result.link.id,
        callbackUrl: "http://localhost:3000/pay/done",
        customer: expect.objectContaining({ contact: "+919876543210" }),
        notes: expect.objectContaining({ purpose: "payment_link", ainfLinkId: result.link.id, donationId: gift.id }),
      })
    );
    expect(h.tables.paymentInterest.get("int_gift")?.status).toBe("LINK_SENT");
    expect(h.email).toHaveBeenCalledTimes(1);
    expect(result.link.emailedAt).toBeInstanceOf(Date);
  });

  it("refuses a second link while one is still open", async () => {
    seedGiftInterest();
    await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    const second = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    expect(second).toMatchObject({ ok: false, status: 409 });
    expect(h.createLink).toHaveBeenCalledTimes(1);
  });

  it("refuses paid and dismissed interests and bad amounts", async () => {
    seedGiftInterest({ status: "PAID" });
    expect(await createLinkForInterest({ interestId: "int_gift", ...linkInput })).toMatchObject({ ok: false, status: 409 });
    h.tables.paymentInterest.get("int_gift")!.status = "DISMISSED";
    expect(await createLinkForInterest({ interestId: "int_gift", ...linkInput })).toMatchObject({ ok: false, status: 409 });
    h.tables.paymentInterest.get("int_gift")!.status = "OPEN";
    expect(await createLinkForInterest({ interestId: "int_gift", ...linkInput, amountPaise: 50 })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await createLinkForInterest({ interestId: "int_gift", ...linkInput, amountPaise: 2_000_000 })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(h.createLink).not.toHaveBeenCalled();
  });

  it("stops before writing anything when Razorpay rejects the keys, and says how to fix them", async () => {
    seedGiftInterest();
    h.keyHealth.mockResolvedValueOnce("rejected");
    const result = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    expect(result).toMatchObject({ ok: false, status: 502 });
    if (!result.ok) expect(result.message).toMatch(/API Keys/);
    expect(h.tables.donation.size).toBe(0);
    expect(h.tables.paymentLink.size).toBe(0);
    expect(h.createLink).not.toHaveBeenCalled();
  });

  it("marks the link and the gift failed when Razorpay refuses", async () => {
    seedGiftInterest();
    h.createLink.mockRejectedValueOnce(new Error("customer email invalid"));
    const result = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect([...h.tables.paymentLink.values()][0]).toMatchObject({ status: "FAILED", lastError: "customer email invalid" });
    expect([...h.tables.donation.values()][0].status).toBe("FAILED");
    expect(h.tables.paymentInterest.get("int_gift")?.status).toBe("OPEN");
  });

  it("creates a membership order for a plan interest, with no SMS when there is no phone", async () => {
    seedMembershipInterest();
    const result = await createLinkForInterest({ interestId: "int_plan", ...linkInput, amountPaise: 9900 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = [...h.tables.membershipOrder.values()][0];
    expect(order).toMatchObject({
      userId: "user_1",
      tierId: "tier_sevak",
      amountPaise: 9900,
      listPaise: 9900,
      changeKind: "NEW",
      recurring: false,
    });
    expect(result.link).toMatchObject({ membershipOrderId: order.id, notifySms: false, customerPhone: null });
  });
});

describe("settling a link", () => {
  async function openGiftLink() {
    seedGiftInterest();
    const created = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    if (!created.ok) throw new Error("setup");
    return created.link;
  }

  const captured = { id: "pay_1", amount: 50000, currency: "INR", status: "captured", captured: true, order_id: "order_link_1" };

  it("refuses a payment whose amount does not match, without touching the link", async () => {
    const link = await openGiftLink();
    const result = await settlePaymentLink(link as never, { ...captured, amount: 100 }, "webhook");
    expect(result).toMatchObject({ ok: false, reason: "amount" });
    expect(h.tables.paymentLink.get(link.id)?.status).toBe("CREATED");
    expect(h.markGift).not.toHaveBeenCalled();
  });

  it("settles the gift once, marks the interest paid, and dedupes the second delivery", async () => {
    const link = await openGiftLink();
    const first = await settlePaymentLink(link as never, captured, "redirect");
    expect(first).toMatchObject({ ok: true, deduplicated: false });
    expect(h.markGift).toHaveBeenCalledWith(
      expect.objectContaining({ donationId: link.donationId, razorpayOrderId: "order_link_1", razorpayPaymentId: "pay_1" })
    );
    expect(h.tables.paymentLink.get(link.id)).toMatchObject({ status: "PAID", razorpayPaymentId: "pay_1" });
    expect(h.tables.paymentInterest.get("int_gift")?.status).toBe("PAID");

    const stale = { ...link, status: "CREATED" };
    const second = await settlePaymentLink(stale as never, captured, "webhook");
    expect(second).toMatchObject({ ok: true, deduplicated: true });
    expect(h.markGift).toHaveBeenCalledTimes(1);
  });

  it("releases the claim when fulfilment fails so the next delivery can retry", async () => {
    const link = await openGiftLink();
    h.markGift.mockResolvedValueOnce({ ok: false, status: 409, message: "The paid amount does not match this gift." });
    await expect(settlePaymentLink(link as never, captured, "webhook")).rejects.toThrow(/does not match/);
    expect(h.tables.paymentLink.get(link.id)).toMatchObject({ status: "CREATED", razorpayPaymentId: null });

    const retry = await settlePaymentLink(link as never, captured, "webhook");
    expect(retry).toMatchObject({ ok: true, deduplicated: false });
  });

  it("settles a membership link through the order it was made with", async () => {
    seedMembershipInterest();
    const created = await createLinkForInterest({ interestId: "int_plan", ...linkInput, amountPaise: 9900 });
    if (!created.ok) throw new Error("setup");
    const result = await settlePaymentLink(
      created.link as never,
      { ...captured, amount: 9900, order_id: "order_plan_1" },
      "webhook"
    );
    expect(result.ok).toBe(true);
    expect(h.markOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipOrderId: created.link.membershipOrderId,
        razorpayOrderId: "order_plan_1",
        razorpayPaymentId: "pay_1",
      })
    );
  });

  it("still honours a payment on a link that was cancelled a moment earlier", async () => {
    const link = await openGiftLink();
    h.tables.paymentLink.get(link.id)!.status = "CANCELLED";
    const result = await settlePaymentLink({ ...link, status: "CANCELLED" } as never, captured, "webhook");
    expect(result).toMatchObject({ ok: true, deduplicated: false });
    expect(h.tables.paymentLink.get(link.id)?.status).toBe("PAID");
  });
});

describe("closing a link", () => {
  it("cancels at Razorpay, fails the gift row, and puts the person back in the queue", async () => {
    seedGiftInterest();
    const created = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    if (!created.ok) throw new Error("setup");
    h.cancelLink.mockResolvedValueOnce({ id: "plink_1", status: "cancelled" });
    const result = await cancelPaymentLink(created.link.id, actor);
    expect(result.ok).toBe(true);
    expect(h.tables.paymentLink.get(created.link.id)?.status).toBe("CANCELLED");
    expect([...h.tables.donation.values()][0].status).toBe("FAILED");
    expect(h.tables.paymentInterest.get("int_gift")?.status).toBe("CONTACTED");
  });

  it("does not cancel a link Razorpay reports as just paid", async () => {
    seedGiftInterest();
    const created = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    if (!created.ok) throw new Error("setup");
    h.cancelLink.mockRejectedValueOnce(new Error("Payment link cannot be cancelled"));
    h.fetchLink.mockResolvedValueOnce({
      id: "plink_1",
      status: "paid",
      payments: [{ payment_id: "pay_9", amount: 50000, status: "captured" }],
    });
    h.getPayment.mockResolvedValueOnce({
      id: "pay_9",
      amount: 50000,
      currency: "INR",
      status: "captured",
      captured: true,
      order_id: "order_9",
    });
    const result = await cancelPaymentLink(created.link.id, actor);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(h.tables.paymentLink.get(created.link.id)?.status).toBe("PAID");
  });

  it("closes an expired link from the webhook and ignores links it does not know", async () => {
    seedGiftInterest();
    const created = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    if (!created.ok) throw new Error("setup");
    expect(await handlePaymentLinkEvent({ eventType: "payment_link.expired", razorpayLinkId: "plink_1" })).toBe("closed");
    expect(h.tables.paymentLink.get(created.link.id)?.status).toBe("EXPIRED");
    expect(await handlePaymentLinkEvent({ eventType: "payment_link.paid", razorpayLinkId: "plink_unknown" })).toBe("ignored");
  });

  it("settles from a payment_link.paid webhook found by our reference id", async () => {
    seedGiftInterest();
    const created = await createLinkForInterest({ interestId: "int_gift", ...linkInput });
    if (!created.ok) throw new Error("setup");
    const outcome = await handlePaymentLinkEvent({
      eventType: "payment_link.paid",
      referenceId: created.link.id,
      payment: { id: "pay_2", amount: 50000, currency: "INR", status: "captured", captured: true, order_id: "order_2" },
    });
    expect(outcome).toBe("settled");
    expect(h.tables.paymentLink.get(created.link.id)?.status).toBe("PAID");
  });
});
