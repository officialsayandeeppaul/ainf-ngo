import { MembershipOrderStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildRevenueSnapshot, revenueKindLabel, revenuePaidWhere } from "@/lib/revenue";

describe("revenue helpers", () => {
  it("labels change kinds", () => {
    expect(revenueKindLabel("NEW")).toBe("New");
    expect(revenueKindLabel("INTERVAL_CHANGE")).toBe("Cycle change");
  });

  it("scopes paid-only queries with optional day bounds", () => {
    const bare = revenuePaidWhere(null, null);
    expect(bare).toEqual({ status: MembershipOrderStatus.PAID });

    const from = new Date("2026-09-01T00:00:00");
    const to = new Date("2026-09-30T23:59:59.999");
    const ranged = revenuePaidWhere(from, to);
    expect(ranged.status).toBe(MembershipOrderStatus.PAID);
    expect(ranged.paidAt).toEqual({ gte: from, lte: to });
  });

  it("builds snapshot totals from paid rows", () => {
    const snapshot = buildRevenueSnapshot({
      paidOrders: [
        {
          amountPaise: 19900,
          creditPaise: 0,
          interval: "MONTHLY",
          changeKind: "NEW",
          paidAt: new Date("2026-09-03T01:41:00Z"),
          createdAt: new Date("2026-09-03T01:40:00Z"),
          tierName: "Friend of AINF",
        },
        {
          amountPaise: 19900,
          creditPaise: 500,
          interval: "MONTHLY",
          changeKind: "RENEWAL",
          paidAt: new Date("2026-09-10T01:41:00Z"),
          createdAt: new Date("2026-09-10T01:40:00Z"),
          tierName: "Friend of AINF",
        },
      ],
      liveMembers: 2,
      payingMembers: 2,
      createdCount: 1,
      failedCount: 0,
      cancelledCount: 0,
      now: new Date("2026-09-23T00:00:00Z"),
    });

    expect(snapshot.paidTotalPaise).toBe(39800);
    expect(snapshot.paidCount).toBe(2);
    expect(snapshot.refundCreditPaise).toBe(500);
    expect(snapshot.monthlyPaise).toBe(39800);
    expect(snapshot.byPlan[0]?.label).toBe("Friend of AINF");
    expect(snapshot.byKind.map((row) => row.label)).toEqual(["New", "Renewal"]);
  });
});

describe("revenue with gifts", () => {
  it("adds captured gifts to the totals, the months, and a by-desk breakdown", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    const snapshot = buildRevenueSnapshot({
      paidOrders: [
        { amountPaise: 19900, creditPaise: 0, interval: "MONTHLY", changeKind: "NEW", paidAt: new Date("2026-09-03T00:00:00Z"), createdAt: new Date("2026-09-03T00:00:00Z"), tierName: "Friend of AINF" },
      ],
      paidGifts: [
        { amountPaise: 50000, paidAt: new Date("2026-10-25T18:23:00Z"), createdAt: new Date("2026-10-25T18:22:00Z"), targetTitle: "Swasthya" },
        { amountPaise: 20000, paidAt: new Date("2026-10-01T00:00:00Z"), createdAt: new Date("2026-10-01T00:00:00Z"), targetTitle: "AINF overall" },
      ],
      refundedGiftPaise: 10000,
      liveMembers: 0,
      payingMembers: 1,
      createdCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      now,
    });
    expect(snapshot).toMatchObject({
      paidTotalPaise: 89900,
      paidCount: 3,
      membershipPaise: 19900,
      membershipCount: 1,
      giftPaise: 70000,
      giftCount: 2,
      refundedGiftPaise: 10000,
    });
    expect(snapshot.byDesk).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Swasthya", paise: 50000 }),
        expect.objectContaining({ label: "AINF overall", paise: 20000 }),
      ])
    );
    const october = snapshot.byMonth.find((row) => row.key === "2026-10");
    expect(october?.paise).toBe(70000);
    expect(snapshot.byPlan).toEqual([expect.objectContaining({ label: "Friend of AINF", paise: 19900 })]);
  });

  it("keeps the membership-only numbers when no gifts are passed", () => {
    const snapshot = buildRevenueSnapshot({
      paidOrders: [],
      liveMembers: 0,
      payingMembers: 0,
      createdCount: 0,
      failedCount: 0,
      cancelledCount: 0,
    });
    expect(snapshot).toMatchObject({ paidTotalPaise: 0, giftPaise: 0, giftCount: 0, byDesk: [] });
  });
});
