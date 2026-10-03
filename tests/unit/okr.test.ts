import { describe, expect, it } from "vitest";
import { OKRS, OKR_PAGE_SIZE, okrProgress, paginateOkrs } from "@/lib/okr";

describe("paginateOkrs", () => {
  it("pages the catalog so long lists never dump every row at once", () => {
    const first = paginateOkrs(1, 4);
    expect(first.page).toBe(1);
    expect(first.pages).toBe(2);
    expect(first.total).toBe(OKRS.length);
    expect(first.items).toHaveLength(4);
    expect(first.items[0]?.id).toBe(OKRS[0]?.id);

    const second = paginateOkrs(2, 4);
    expect(second.items).toHaveLength(4);
    expect(second.items[0]?.id).toBe(OKRS[4]?.id);
    expect(second.items.every((item) => !first.items.includes(item))).toBe(true);
  });

  it("clamps out-of-range pages and treats invalid page as 1", () => {
    expect(paginateOkrs(99).page).toBe(2);
    expect(paginateOkrs(0).page).toBe(1);
    expect(paginateOkrs(Number.NaN).page).toBe(1);
  });

  it("uses the default page size", () => {
    expect(OKR_PAGE_SIZE).toBe(4);
    expect(paginateOkrs(1).items).toHaveLength(OKR_PAGE_SIZE);
  });
});

describe("okrProgress", () => {
  it("averages key-result completion and caps at 100", () => {
    expect(
      okrProgress({
        id: "t",
        cycle: "2026 H2",
        objective: "Test",
        owner: "QA",
        status: "on_track",
        keyResults: [
          { label: "A", current: 50, target: 100, unit: "" },
          { label: "B", current: 200, target: 100, unit: "" },
        ],
      })
    ).toBe(75);
  });
});
