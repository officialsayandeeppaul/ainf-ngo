import { describe, expect, it } from "vitest";
import {
  catalogBenefits,
  mergeCatalog,
  normalizePlanBenefits,
  PLAN_BENEFIT_CATALOG,
  PLAN_BENEFIT_LIMIT,
} from "@/lib/plan-benefits";

describe("normalizePlanBenefits", () => {
  it("keeps included and not-included lines in order", () => {
    expect(
      normalizePlanBenefits([
        { label: "  Friend badge  ", included: true },
        { label: "Donor roll", included: false },
      ])
    ).toEqual([
      { label: "Friend badge", included: true },
      { label: "Donor roll", included: false },
    ]);
  });

  it("drops empty, short, and duplicate labels", () => {
    expect(
      normalizePlanBenefits([
        { label: "A", included: true },
        { label: "Gold badge", included: true },
        { label: "gold badge", included: false },
        { label: "   ", included: true },
        null,
      ])
    ).toEqual([{ label: "Gold badge", included: true }]);
  });

  it("caps the stack so a card cannot overflow", () => {
    const rows = Array.from({ length: PLAN_BENEFIT_LIMIT + 4 }, (_, i) => ({
      label: `Benefit ${i + 1}`,
      included: i % 2 === 0,
    }));
    expect(normalizePlanBenefits(rows)).toHaveLength(PLAN_BENEFIT_LIMIT);
  });

  it("treats missing included as true", () => {
    expect(normalizePlanBenefits([{ label: "Monthly support" }])).toEqual([
      { label: "Monthly support", included: true },
    ]);
  });
});

describe("comparison catalog", () => {
  it("loads a full compare set and only adds missing lines", () => {
    const loaded = catalogBenefits(false);
    expect(loaded).toHaveLength(PLAN_BENEFIT_CATALOG.length);
    expect(loaded.every((row) => row.included === false)).toBe(true);

    const merged = mergeCatalog([{ label: PLAN_BENEFIT_CATALOG[0], included: true }]);
    expect(merged[0]).toEqual({ label: PLAN_BENEFIT_CATALOG[0], included: true });
    expect(merged).toHaveLength(PLAN_BENEFIT_CATALOG.length);
  });
});
