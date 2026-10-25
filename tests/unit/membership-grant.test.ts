import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingInterval } from "@prisma/client";

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  tier: null as Record<string, unknown> | null,
  orders: [] as Array<Record<string, unknown>>,
  userUpdates: [] as Array<Record<string, unknown>>,
  cancelSub: vi.fn(async () => {}),
  ensureCard: vi.fn(async () => ({ regNo: "AINF-2027-0001" })),
  email: vi.fn(async () => ({ sent: true })),
  audit: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => (h.user ? { ...h.user } : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.userUpdates.push(data);
        return { ...h.user, ...data };
      }),
    },
    membershipTier: { findUnique: vi.fn(async () => (h.tier ? { ...h.tier } : null)) },
    membershipOrder: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `order_${h.orders.length + 1}`, ...data };
        h.orders.push(row);
        return row;
      }),
    },
    $transaction: vi.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/razorpay", () => ({ cancelRazorpaySubscription: h.cancelSub }));
vi.mock("@/lib/membership-card", () => ({ ensureMembershipCard: h.ensureCard }));
vi.mock("@/lib/email", () => ({ sendMembershipGrantedEmail: h.email }));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

import { grantEndDate, grantInterval, grantMembership } from "@/lib/membership-grant";

const actor = { userId: "admin_1", clerkId: "clerk_admin", role: "SUPER_ADMIN" as const };
const now = new Date("2026-10-25T10:00:00Z");

beforeEach(() => {
  h.user = {
    id: "user_1",
    email: "ravi@example.com",
    firstName: "Ravi",
    membershipTierId: null,
    membershipExpiresAt: null,
    membershipSubscriptionId: null,
    membershipTier: null,
  };
  h.tier = { id: "tier_gold", name: "Gold Sevak", badge: "Gold", monthlyPaise: 49900 };
  h.orders = [];
  h.userUpdates = [];
  h.cancelSub.mockClear();
  h.ensureCard.mockClear();
  h.email.mockClear();
  h.audit.mockClear();
});

describe("grant length", () => {
  it("adds calendar months for presets", () => {
    expect(grantEndDate("1m", now)?.toISOString()).toBe("2026-11-25T10:00:00.000Z");
    expect(grantEndDate("1y", now)?.toISOString()).toBe("2027-10-25T10:00:00.000Z");
    expect(grantEndDate("5y", now)?.toISOString()).toBe("2031-10-25T10:00:00.000Z");
  });

  it("accepts a custom day only from tomorrow up to ten years out", () => {
    expect(grantEndDate("custom", now, "2027-01-31")?.toISOString()).toBe("2027-01-31T23:59:59.000Z");
    expect(grantEndDate("custom", now, "2026-10-24")).toBeNull();
    expect(grantEndDate("custom", now, "2040-01-01")).toBeNull();
    expect(grantEndDate("custom", now, "31/01/2027")).toBeNull();
    expect(grantEndDate("custom", now, null)).toBeNull();
  });

  it("reads a year or more as yearly", () => {
    expect(grantInterval(now, grantEndDate("6m", now)!)).toBe(BillingInterval.MONTHLY);
    expect(grantInterval(now, grantEndDate("1y", now)!)).toBe(BillingInterval.YEARLY);
  });
});

describe("granting membership", () => {
  it("records a ₹0 paid order marked as granted, makes the badge live, and issues the card", async () => {
    const endsAt = grantEndDate("1y", new Date())!;
    const result = await grantMembership({
      userId: "user_1",
      tierId: "tier_gold",
      endsAt,
      note: "Founding volunteer",
      notify: true,
      actor,
    });
    expect(result).toMatchObject({ ok: true, cardRegNo: "AINF-2027-0001", cancelledMandate: false });
    expect(h.orders[0]).toMatchObject({
      amountPaise: 0,
      status: "PAID",
      changeKind: "NEW",
      grantedByUserId: "admin_1",
      grantNote: "Founding volunteer",
      recurring: false,
      interval: "YEARLY",
    });
    expect(h.userUpdates[0]).toMatchObject({
      membershipTierId: "tier_gold",
      membershipExpiresAt: endsAt,
      membershipTermPaise: 0,
      membershipSubscriptionId: null,
      membershipCancelAtPeriodEnd: false,
    });
    expect(h.ensureCard).toHaveBeenCalledWith("user_1");
    expect(h.email).toHaveBeenCalledWith(expect.objectContaining({ to: "ravi@example.com", tierName: "Gold Sevak" }));
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "membership.granted", targetId: "user_1" }));
  });

  it("stops a live auto-renew mandate so the member is never charged for the old plan", async () => {
    h.user = {
      ...h.user!,
      membershipTierId: "tier_basic",
      membershipExpiresAt: new Date(Date.now() + 10 * 86_400_000),
      membershipSubscriptionId: "sub_1",
      membershipTier: { id: "tier_basic", name: "Basic", monthlyPaise: 9900 },
    };
    const result = await grantMembership({
      userId: "user_1",
      tierId: "tier_gold",
      endsAt: grantEndDate("3m", new Date())!,
      notify: false,
      actor,
    });
    expect(result).toMatchObject({ ok: true, cancelledMandate: true });
    expect(h.cancelSub).toHaveBeenCalledWith("sub_1", false);
    expect(h.orders[0]).toMatchObject({ changeKind: "UPGRADE", previousTierId: "tier_basic" });
    expect(h.email).not.toHaveBeenCalled();
  });

  it("refuses an account that has not signed up and a plan that does not exist", async () => {
    h.user = null;
    expect(
      await grantMembership({ userId: "nobody", tierId: "tier_gold", endsAt: grantEndDate("1m")!, notify: false, actor })
    ).toMatchObject({ ok: false, status: 404 });
    h.user = { id: "user_1", membershipTier: null };
    h.tier = null;
    expect(
      await grantMembership({ userId: "user_1", tierId: "missing", endsAt: grantEndDate("1m")!, notify: false, actor })
    ).toMatchObject({ ok: false, status: 404 });
    expect(h.orders).toHaveLength(0);
  });
});
