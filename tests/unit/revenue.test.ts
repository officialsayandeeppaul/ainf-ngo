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
