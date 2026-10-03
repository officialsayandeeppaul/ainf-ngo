import { describe, expect, it } from "vitest";
import {
  chargePaise,
  discountLabel,
  formatInr,
  rupeesToPaise,
  slugifyTierName,
  yearlyPaise,
  yearlySavingsPaise,
} from "@/lib/membership";

describe("membership pricing", () => {
  it("converts rupees to paise without float drift", () => {
    expect(rupeesToPaise(499)).toBe(49900);
    expect(rupeesToPaise(99.5)).toBe(9950);
  });

  it("formats INR without locale grouping", () => {
    expect(formatInr(49900)).toBe("₹499");
    expect(formatInr(9950)).toBe("₹99.50");
  });

  it("applies percent and flat yearly discounts", () => {
    const monthly = { monthlyPaise: 10000, yearlyDiscountKind: "NONE" as const, yearlyDiscountValue: 0 };
    expect(yearlyPaise(monthly)).toBe(120000);

    expect(
      yearlyPaise({ monthlyPaise: 10000, yearlyDiscountKind: "PERCENT", yearlyDiscountValue: 20 })
    ).toBe(96000);

    expect(
      yearlyPaise({ monthlyPaise: 10000, yearlyDiscountKind: "FLAT", yearlyDiscountValue: 20000 })
    ).toBe(100000);

    expect(
      yearlySavingsPaise({ monthlyPaise: 10000, yearlyDiscountKind: "PERCENT", yearlyDiscountValue: 20 })
    ).toBe(24000);
  });

  it("never prices yearly below zero", () => {
    expect(yearlyPaise({ monthlyPaise: 1000, yearlyDiscountKind: "FLAT", yearlyDiscountValue: 999999 })).toBe(0);
  });

  it("charges monthly or discounted yearly", () => {
    const gold = { monthlyPaise: 49900, yearlyDiscountKind: "PERCENT" as const, yearlyDiscountValue: 20 };
    expect(chargePaise(gold, "MONTHLY")).toBe(49900);
    expect(chargePaise(gold, "YEARLY")).toBe(479040);
  });

  it("labels discounts and slugs names", () => {
    expect(discountLabel("PERCENT", 15)).toBe("15% off yearly");
    expect(discountLabel("FLAT", 50000)).toBe("₹500 off yearly");
    expect(slugifyTierName("Gold Patron")).toBe("gold-patron");
  });
});
