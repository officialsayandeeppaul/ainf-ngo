import { describe, expect, it } from "vitest";
import { lastMonthKeys, monthKeyUtc, paidByMonth, paidByPlan, sumPaise } from "@/lib/crm-metrics";

describe("paidByMonth", () => {
  it("buckets captured payments into the last six UTC months, newest month last", () => {
    const now = new Date("2026-09-03T06:00:00.000Z");
    const rows = paidByMonth(
      [
        { paidAt: new Date("2026-09-03T01:41:00.000Z"), createdAt: new Date("2026-09-03T01:38:00.000Z"), amountPaise: 19900 },
        { paidAt: new Date("2026-07-01T00:00:00.000Z"), createdAt: new Date("2026-07-01T00:00:00.000Z"), amountPaise: 49900 },
        { paidAt: new Date("2025-12-01T00:00:00.000Z"), createdAt: new Date("2025-12-01T00:00:00.000Z"), amountPaise: 99900 },
      ],
      6,
      now
    );
    expect(rows.map((row) => row.key)).toEqual(lastMonthKeys(6, now));
    expect(rows.at(-1)).toMatchObject({ key: "2026-09", paise: 19900 });
    expect(rows.find((row) => row.key === "2026-07")?.paise).toBe(49900);
    expect(rows.every((row) => row.key !== "2025-12")).toBe(true);
  });
});

describe("paidByPlan", () => {
  it("sums each plan and sorts the largest first", () => {
    expect(
      paidByPlan([
        { tierName: "Friend of AINF", amountPaise: 19900 },
        { tierName: "Gold member", amountPaise: 49900 },
        { tierName: "Friend of AINF", amountPaise: 19900 },
      ])
    ).toEqual([
      { label: "Gold member", paise: 49900 },
      { label: "Friend of AINF", paise: 39800 },
    ]);
  });
});

describe("helpers", () => {
  it("keys a date in UTC and sums paise", () => {
    expect(monthKeyUtc(new Date("2026-09-03T22:00:00.000Z"))).toBe("2026-09");
    expect(sumPaise([{ amountPaise: 19900 }, { amountPaise: 30000 }])).toBe(49900);
  });
});
