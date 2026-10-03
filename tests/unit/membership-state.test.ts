import { describe, expect, it } from "vitest";
import {
  canStartPayment,
  classifyMembershipCapture,
  extendExpiry,
  membershipIsLive,
  nextExpiry,
  paymentBlockMessage,
  PENDING_ORDER_MS,
  shouldStripBadge,
} from "@/lib/membership-state";

describe("membership live vs expired", () => {
  const now = new Date("2026-09-03T10:00:00.000Z");

  it("is live only with a future end date and a tier", () => {
    expect(
      membershipIsLive(
        { membershipTierId: "tier_1", membershipExpiresAt: new Date("2026-10-04T10:00:00.000Z") },
        now
      )
    ).toBe(true);
    expect(
      membershipIsLive(
        { membershipTierId: "tier_1", membershipExpiresAt: new Date("2026-09-03T09:59:59.000Z") },
        now
      )
    ).toBe(false);
    expect(membershipIsLive({ membershipTierId: null, membershipExpiresAt: new Date("2026-10-04") }, now)).toBe(
      false
    );
  });

  it("strips the badge on expiry and when an end date is missing", () => {
    expect(
      shouldStripBadge(
        { membershipTierId: "tier_1", membershipExpiresAt: new Date("2026-09-03T09:00:00.000Z") },
        now
      )
    ).toBe(true);
    expect(shouldStripBadge({ membershipTierId: "tier_1", membershipExpiresAt: null }, now)).toBe(true);
    expect(shouldStripBadge({ membershipTierId: null, membershipExpiresAt: null }, now)).toBe(false);
    expect(
      shouldStripBadge(
        { membershipTierId: "tier_1", membershipExpiresAt: new Date("2026-10-04T10:00:00.000Z") },
        now
      )
    ).toBe(false);
  });
});

describe("membership term length", () => {
  it("adds one calendar month without overflowing January 31", () => {
    const from = new Date("2026-01-31T12:00:00.000Z");
    expect(nextExpiry(from, "MONTHLY").toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("adds one year for yearly billing", () => {
    const from = new Date("2026-09-03T10:00:00.000Z");
    expect(nextExpiry(from, "YEARLY").toISOString()).toBe("2027-09-03T10:00:00.000Z");
  });

  it("extends from the current end when still live, otherwise from now", () => {
    const now = new Date("2026-09-03T10:00:00.000Z");
    const liveUntil = new Date("2026-10-04T10:00:00.000Z");
    expect(extendExpiry(liveUntil, "MONTHLY", now).toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(extendExpiry(new Date("2026-08-01T10:00:00.000Z"), "MONTHLY", now).toISOString()).toBe(
      "2026-10-03T10:00:00.000Z"
    );
  });
});

describe("payment gate", () => {
  const now = new Date("2026-09-03T10:00:00.000Z");

  it("blocks a second checkout while membership is live, unless this is a plan switch", () => {
    expect(canStartPayment({ live: true, pendingCreatedAt: null, now })).toEqual({
      ok: false,
      reason: "active",
    });
    expect(canStartPayment({ live: true, pendingCreatedAt: null, now, switching: true })).toEqual({
      ok: true,
    });
    expect(paymentBlockMessage("active")).toMatch(/upgrade or downgrade/i);
  });

  it("blocks a second checkout while a Razorpay session is still open", () => {
    const pendingCreatedAt = new Date(now.getTime() - 10 * 60 * 1000);
    expect(canStartPayment({ live: false, pendingCreatedAt, now })).toEqual({
      ok: false,
      reason: "pending",
    });
    expect(canStartPayment({ live: false, pendingCreatedAt: new Date(now.getTime() - PENDING_ORDER_MS - 1), now })).toEqual({
      ok: true,
    });
  });
});

describe("capture classification", () => {
  const seedCreated = { status: "CREATED", razorpayOrderId: "order_1", razorpayPaymentId: null };
  const seedPaid = { status: "PAID", razorpayOrderId: "order_1", razorpayPaymentId: "pay_1" };

  it("treats the first capture as first, a replay of the same payment as attach/duplicate, and the next charge as renewal", () => {
    expect(
      classifyMembershipCapture({
        paymentAlreadyRecorded: false,
        seed: seedCreated,
        incomingOrderId: "order_1",
        incomingPaymentId: "pay_1",
      })
    ).toBe("first");

    expect(
      classifyMembershipCapture({
        paymentAlreadyRecorded: true,
        seed: seedPaid,
        incomingOrderId: "order_1",
        incomingPaymentId: "pay_1",
      })
    ).toBe("duplicate");

    expect(
      classifyMembershipCapture({
        paymentAlreadyRecorded: false,
        seed: { ...seedPaid, razorpayPaymentId: null },
        incomingOrderId: "order_1",
        incomingPaymentId: "pay_1",
      })
    ).toBe("attach");

    expect(
      classifyMembershipCapture({
        paymentAlreadyRecorded: false,
        seed: seedPaid,
        incomingOrderId: "order_2",
        incomingPaymentId: "pay_2",
      })
    ).toBe("renewal");
  });

  it("rejects captures with no matching order", () => {
    expect(
      classifyMembershipCapture({
        paymentAlreadyRecorded: false,
        seed: null,
        incomingOrderId: "order_missing",
        incomingPaymentId: "pay_missing",
      })
    ).toBe("unknown");
  });
});
