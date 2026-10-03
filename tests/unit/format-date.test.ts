import { describe, expect, it } from "vitest";
import { formatClock, formatDay, formatDayTime } from "@/lib/format-date";

describe("format-date", () => {
  it("prints India-time stamps without depending on the host locale", () => {
    const noonIst = new Date("2026-09-03T06:30:00.000Z");
    expect(formatDay(noonIst)).toBe("03 Sep 2026");
    expect(formatClock(noonIst)).toBe("12:00");
    expect(formatDayTime(noonIst)).toBe("03 Sep 2026, 12:00");
  });
});
