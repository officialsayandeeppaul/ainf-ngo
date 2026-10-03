import { beforeEach, describe, expect, it, vi } from "vitest";
import { TIERS, checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";

/**
 * Exercises the in-memory fallback (no Upstash credentials in the test env).
 * The production fail-closed branch is covered separately below.
 */

function uniqueId(label: string) {
  return `${label}-${Math.random().toString(36).slice(2)}`;
}

describe("sliding window tiers", () => {
  it("declares the tiers the plan specifies", () => {
    expect(TIERS.auth).toMatchObject({ limit: 10, window: "1 m" });
    expect(TIERS.kycSession).toMatchObject({ limit: 3, window: "1 h" });
    expect(TIERS.panVerify).toMatchObject({ limit: 3, window: "1 d" });
    expect(TIERS.adminMutation).toMatchObject({ limit: 30, window: "1 m" });
    expect(TIERS.webhook).toMatchObject({ limit: 100, window: "1 m" });
    expect(TIERS.checkout).toMatchObject({ limit: 8, window: "1 m" });
    expect(TIERS.bootstrap).toMatchObject({ limit: 5, window: "1 h" });
  });

  it("allows exactly the tier limit then denies", async () => {
    const id = uniqueId("kyc");
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await checkRateLimit("kycSession", id));
    }
    expect(results.slice(0, 3).every((r) => r.success)).toBe(true);
    expect(results[3].success).toBe(false);
  });

  it("counts down remaining", async () => {
    const id = uniqueId("pan");
    const first = await checkRateLimit("panVerify", id);
    const second = await checkRateLimit("panVerify", id);
    expect(first.remaining).toBe(2);
    expect(second.remaining).toBe(1);
  });

  it("keeps separate windows per identifier", async () => {
    const a = uniqueId("a");
    const b = uniqueId("b");
    for (let i = 0; i < 3; i++) await checkRateLimit("kycSession", a);
    expect((await checkRateLimit("kycSession", a)).success).toBe(false);
    // b must be unaffected by a exhausting its budget.
    expect((await checkRateLimit("kycSession", b)).success).toBe(true);
  });

  it("keeps separate windows per tier", async () => {
    const id = uniqueId("shared");
    for (let i = 0; i < 3; i++) await checkRateLimit("kycSession", id);
    expect((await checkRateLimit("kycSession", id)).success).toBe(false);
    expect((await checkRateLimit("panVerify", id)).success).toBe(true);
  });

  it("bootstrap allows five attempts per hour then locks out", async () => {
    const id = uniqueId("bootstrap");
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit("bootstrap", id)).success).toBe(true);
    }
    const blocked = await checkRateLimit("bootstrap", id);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("frees the window once entries age out", async () => {
    vi.useFakeTimers();
    try {
      const id = uniqueId("expiry");
      for (let i = 0; i < 3; i++) await checkRateLimit("kycSession", id);
      expect((await checkRateLimit("kycSession", id)).success).toBe(false);

      // kycSession is a 1 hour window.
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
      expect((await checkRateLimit("kycSession", id)).success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the fallback as degraded so callers can log it", async () => {
    const result = await checkRateLimit("auth", uniqueId("degraded"));
    expect(result.degraded).toBe(true);
  });
});

describe("response headers", () => {
  it("emits RateLimit-* headers", () => {
    const headers = rateLimitHeaders({
      success: false,
      limit: 3,
      remaining: 0,
      reset: Date.now() + 30_000,
      degraded: false,
    });
    expect(headers["RateLimit-Limit"]).toBe("3");
    expect(headers["RateLimit-Remaining"]).toBe("0");
    expect(Number(headers["RateLimit-Reset"])).toBeGreaterThan(0);
  });

  it("never emits a negative reset", () => {
    const headers = rateLimitHeaders({
      success: true,
      limit: 3,
      remaining: 2,
      reset: Date.now() - 10_000,
      degraded: false,
    });
    expect(Number(headers["RateLimit-Reset"])).toBe(0);
  });
});

describe("production without a Redis backend", () => {
  it("fails closed instead of allowing unlimited traffic", async () => {
    // Re-import with NODE_ENV=production so the module-level isProduction flag
    // is recomputed; the fallback must deny rather than allow.
    vi.resetModules();
    const previous = process.env.NODE_ENV;
    Object.assign(process.env, { NODE_ENV: "production" });
    try {
      const mod = await import("@/lib/ratelimit");
      const result = await mod.checkRateLimit("adminMutation", uniqueId("prod"));
      expect(result.success).toBe(false);
      expect(result.degraded).toBe(true);
    } finally {
      Object.assign(process.env, { NODE_ENV: previous });
      vi.resetModules();
    }
  });
});
