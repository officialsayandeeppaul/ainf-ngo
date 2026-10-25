import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentInterestStatus, PaymentPurpose } from "@prisma/client";

type Row = Record<string, unknown> & { id: string; attempts: number; status: string };

const h = vi.hoisted(() => ({
  rows: new Map<string, Row>(),
  email: vi.fn(async () => ({ sent: true })),
  audit: vi.fn(async () => {}),
}));

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === "object" && "in" in (cond as object)) {
      return (cond as { in: unknown[] }).in.includes(row[key]);
    }
    return (row[key] ?? null) === cond;
  });
}

vi.mock("@/lib/db", () => ({
  db: {
    paymentInterest: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const hit = [...h.rows.values()].find((row) => matches(row, where));
        return hit ? { ...hit } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `int_${h.rows.size + 1}`, attempts: 1, status: "OPEN", createdAt: new Date(), ...data } as Row;
        h.rows.set(row.id, row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = h.rows.get(where.id)!;
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === "object" && "increment" in (value as object)) {
            row[key] = (row[key] as number) + (value as { increment: number }).increment;
          } else {
            row[key] = value;
          }
        }
        return { ...row };
      }),
    },
  },
}));

vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

vi.mock("@/lib/email", () => ({ sendPaymentInterestEmail: h.email }));

import { interestLabel, interestMatchWhere, pausedPayload, recordPaymentInterest } from "@/lib/payment-interest";

beforeEach(() => {
  h.rows.clear();
  h.email.mockClear();
  h.audit.mockClear();
});

const gift = {
  purpose: PaymentPurpose.DONATION,
  name: "Mina Hembrom",
  email: "Mina@Example.com",
  phone: "9876543210",
  amountPaise: 50000,
  donationKind: "MISSION" as const,
  targetSlug: "Shiksha",
  targetTitle: "Shiksha",
};

describe("interest matching", () => {
  it("matches a gift by lower-cased email, target, and an active status", () => {
    expect(interestMatchWhere(gift)).toEqual({
      purpose: PaymentPurpose.DONATION,
      email: "mina@example.com",
      status: { in: [PaymentInterestStatus.OPEN, PaymentInterestStatus.CONTACTED, PaymentInterestStatus.LINK_SENT] },
      donationKind: "MISSION",
      targetSlug: "shiksha",
    });
  });

  it("matches a plan by tier, not by gift target", () => {
    const where = interestMatchWhere({
      purpose: PaymentPurpose.MEMBERSHIP,
      name: "A",
      email: "a@example.com",
      amountPaise: 9900,
      targetTitle: "Field Sevak",
      tierId: "tier_1",
    });
    expect(where).toMatchObject({ tierId: "tier_1" });
    expect(where).not.toHaveProperty("targetSlug");
  });

  it("labels gifts and plans for people and admins", () => {
    expect(interestLabel({ purpose: "DONATION", targetTitle: "Shiksha" })).toBe("a gift to Shiksha");
    expect(interestLabel({ purpose: "MEMBERSHIP", targetTitle: "Field Sevak", interval: "YEARLY" })).toBe(
      "Field Sevak membership · yearly"
    );
  });
});

describe("recording interest", () => {
  it("creates one row on the first try and emails a confirmation", async () => {
    const result = await recordPaymentInterest(gift);
    expect(result.created).toBe(true);
    expect(h.rows.size).toBe(1);
    expect([...h.rows.values()][0]).toMatchObject({ email: "mina@example.com", targetSlug: "shiksha", status: "OPEN" });
    expect(h.email).toHaveBeenCalledTimes(1);
    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "payments.interest_recorded" }));
  });

  it("folds a repeat try into the same row, counts it, and does not email again", async () => {
    await recordPaymentInterest(gift);
    const again = await recordPaymentInterest({ ...gift, amountPaise: 75000 });
    expect(again.created).toBe(false);
    expect(h.rows.size).toBe(1);
    expect(again.interest).toMatchObject({ attempts: 2, amountPaise: 75000 });
    expect(h.email).toHaveBeenCalledTimes(1);
  });

  it("starts a new row once the earlier one was dismissed", async () => {
    const first = await recordPaymentInterest(gift);
    h.rows.get(first.interest.id)!.status = "DISMISSED";
    const second = await recordPaymentInterest(gift);
    expect(second.created).toBe(true);
    expect(h.rows.size).toBe(2);
  });

  it("still records the interest when the confirmation email throws", async () => {
    h.email.mockRejectedValueOnce(new Error("resend down"));
    const result = await recordPaymentInterest(gift);
    expect(result.created).toBe(true);
  });
});

describe("paused response", () => {
  it("tells the visitor what was saved and where we will write", () => {
    const body = pausedPayload(
      { pausedMessage: "" },
      {
        id: "int_1",
        purpose: "DONATION",
        targetTitle: "Shiksha",
        interval: null,
        amountPaise: 50000,
        email: "mina@example.com",
        attempts: 2,
      }
    );
    expect(body).toMatchObject({
      error: "payments_paused",
      title: "Thank you for your interest",
      interest: { id: "int_1", what: "a gift to Shiksha", amount: "₹500", email: "mina@example.com", repeat: true },
    });
    expect(body.message.length).toBeGreaterThan(20);
  });
});
