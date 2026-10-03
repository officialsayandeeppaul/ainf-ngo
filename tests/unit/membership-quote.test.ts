import { describe, expect, it } from "vitest";
import {
  applyOfferDiscount,
  classifyChange,
  inferPeriodStart,
  pickBestOffer,
  quoteMembershipChange,
  unusedCreditPaise,
} from "@/lib/membership-quote";
import { nextExpiry } from "@/lib/membership-state";

describe("Jan 1 Friend → Jan 5 Gold (Netflix/Jio style)", () => {
  const periodStart = new Date("2026-01-01T00:00:00.000Z");
  const periodEnd = nextExpiry(periodStart, "MONTHLY");
  const now = new Date("2026-01-05T00:00:00.000Z");

  it("starts the new term on the switch date, not the old expiry", () => {
    expect(periodEnd.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(nextExpiry(now, "MONTHLY").toISOString()).toBe("2026-02-05T00:00:00.000Z");
  });

  it("credits unused Friend days and charges only the Gold gap", () => {
    const quote = quoteMembershipChange({
      now,
      live: true,
      from: {
        tierId: "friend",
        monthlyPaise: 19900,
        interval: "MONTHLY",
        expiresAt: periodEnd,
        periodStartedAt: periodStart,
        termPaise: 19900,
      },
      to: {
        tierId: "gold",
        interval: "MONTHLY",
        pricing: { monthlyPaise: 29900, yearlyDiscountKind: "NONE", yearlyDiscountValue: 0 },
      },
      offer: null,
    });
    const expectedCredit = unusedCreditPaise({
      termPaise: 19900,
      periodStart,
      periodEnd,
      now,
    });
    expect(quote.kind).toBe("upgrade");
    expect(quote.creditPaise).toBe(expectedCredit);
    expect(quote.duePaise).toBe(29900 - expectedCredit);
    expect(quote.expiresAt.toISOString()).toBe("2026-02-05T00:00:00.000Z");
    expect(expectedCredit).toBeGreaterThan(15000);
    expect(quote.duePaise).toBeGreaterThan(10000);
  });
});

describe("classifyChange", () => {
  it("detects upgrade, downgrade, interval, same, and new", () => {
    const base = {
      fromTierId: "friend",
      fromMonthlyPaise: 19900,
      fromInterval: "MONTHLY" as const,
      toTierId: "gold",
      toMonthlyPaise: 49900,
      toInterval: "MONTHLY" as const,
    };
    expect(classifyChange({ live: false, ...base })).toBe("new");
    expect(classifyChange({ live: true, ...base })).toBe("upgrade");
    expect(
      classifyChange({
        live: true,
        ...base,
        toTierId: "friend",
        toMonthlyPaise: 19900,
        toInterval: "YEARLY",
      })
    ).toBe("interval");
    expect(
      classifyChange({
        live: true,
        ...base,
        fromTierId: "gold",
        fromMonthlyPaise: 49900,
        toTierId: "friend",
        toMonthlyPaise: 19900,
      })
    ).toBe("downgrade");
    expect(
      classifyChange({
        live: true,
        ...base,
        toTierId: "friend",
        toMonthlyPaise: 19900,
      })
    ).toBe("same");
  });
});

describe("offers", () => {
  it("applies percent and flat cuts, and picks the larger saving", () => {
    expect(applyOfferDiscount(19900, { kind: "PERCENT", value: 10 })).toEqual({
      payablePaise: 17910,
      offPaise: 1990,
    });
    expect(applyOfferDiscount(19900, { kind: "FLAT", value: 5000 })).toEqual({
      payablePaise: 14900,
      offPaise: 5000,
    });
    const best = pickBestOffer(19900, [
      { id: "a", name: "10%", kind: "PERCENT", value: 10 },
      { id: "b", name: "₹80 off", kind: "FLAT", value: 8000 },
    ]);
    expect(best?.id).toBe("b");
  });
});

describe("downgrade leftover", () => {
  it("pays nothing today and extends the new term with leftover credit", () => {
    const periodStart = new Date("2026-01-01T00:00:00.000Z");
    const periodEnd = new Date("2026-02-01T00:00:00.000Z");
    const now = new Date("2026-01-05T00:00:00.000Z");
    const quote = quoteMembershipChange({
      now,
      live: true,
      from: {
        tierId: "gold",
        monthlyPaise: 49900,
        interval: "MONTHLY",
        expiresAt: periodEnd,
        periodStartedAt: periodStart,
        termPaise: 49900,
      },
      to: {
        tierId: "friend",
        interval: "MONTHLY",
        pricing: { monthlyPaise: 19900, yearlyDiscountKind: "NONE", yearlyDiscountValue: 0 },
      },
      offer: null,
    });
    expect(quote.kind).toBe("downgrade");
    expect(quote.duePaise).toBe(0);
    expect(quote.leftoverPaise).toBeGreaterThan(0);
    expect(quote.expiresAt.getTime()).toBeGreaterThan(nextExpiry(now, "MONTHLY").getTime());
  });
});

describe("inferPeriodStart", () => {
  it("walks back one month from the paid-through date", () => {
    expect(inferPeriodStart(new Date("2026-02-01T00:00:00.000Z"), "MONTHLY").toISOString()).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });
});
