import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, isProduction, isRedisConfigured } from "./env";

/**
 * Sliding-window rate limiting.
 *
 * Production fails closed: if Redis is unreachable or unconfigured, requests are
 * denied rather than silently unlimited. Development falls back to an in-memory
 * window so the app is usable without an Upstash account, which is explicitly
 * not safe across processes and never used when NODE_ENV is production.
 */

export type LimiterName =
  | "auth"
  | "kycSession"
  | "panVerify"
  | "adminMutation"
  | "adminRead"
  | "webhook"
  | "bootstrap"
  | "otpSend"
  | "otpVerify"
  | "checkout"
  | "contact"
  | "donate";

type Tier = { limit: number; window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`; prefix: string };

export const TIERS: Record<LimiterName, Tier> = {
  auth: { limit: 10, window: "1 m", prefix: "rl:auth" },
  kycSession: { limit: 3, window: "1 h", prefix: "rl:kyc" },
  // PAN verification spends a non-refundable vendor credit on success.
  panVerify: { limit: 3, window: "1 d", prefix: "rl:pan" },
  adminMutation: { limit: 30, window: "1 m", prefix: "rl:adminw" },
  adminRead: { limit: 120, window: "1 m", prefix: "rl:adminr" },
  webhook: { limit: 100, window: "1 m", prefix: "rl:hook" },
  bootstrap: { limit: 5, window: "1 h", prefix: "rl:bootstrap" },
  otpSend: { limit: 3, window: "1 h", prefix: "rl:otpsend" },
  otpVerify: { limit: 8, window: "1 h", prefix: "rl:otpver" },
  checkout: { limit: 8, window: "1 m", prefix: "rl:pay" },
  contact: { limit: 20, window: "1 h", prefix: "rl:contact:v2" },
  donate: { limit: 8, window: "1 h", prefix: "rl:donate" },
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  degraded: boolean;
};

let redis: Redis | null = null;
const limiters = new Map<LimiterName, Ratelimit>();

function getRedis(): Redis | null {
  if (!isRedisConfigured) return null;
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export function getRedisClient(): Redis | null {
  return getRedis();
}

function getLimiter(name: LimiterName): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  if (!limiters.has(name)) {
    const tier = TIERS[name];
    limiters.set(
      name,
      new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(tier.limit, tier.window),
        prefix: tier.prefix,
        analytics: false,
      })
    );
  }
  return limiters.get(name)!;
}

// ---------------------------------------------------------------------------
// Development-only in-memory fallback
// ---------------------------------------------------------------------------

const WINDOW_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function windowMs(window: Tier["window"]): number {
  const [amount, unit] = window.split(" ");
  return Number(amount) * (WINDOW_MS[unit] ?? 60_000);
}

const memory = new Map<string, number[]>();

function memoryLimit(name: LimiterName, key: string): RateLimitResult {
  const tier = TIERS[name];
  const span = windowMs(tier.window);
  const now = Date.now();
  const bucket = (memory.get(key) ?? []).filter((t) => now - t < span);
  const success = bucket.length < tier.limit;
  if (success) bucket.push(now);
  memory.set(key, bucket);
  if (memory.size > 10_000) memory.clear();
  return {
    success,
    limit: tier.limit,
    remaining: Math.max(0, tier.limit - bucket.length),
    reset: (bucket[0] ?? now) + span,
    degraded: true,
  };
}

/**
 * Consumes one unit from `name`'s window for `identifier`.
 * Callers should pass the most specific stable identifier available
 * (Clerk user id first, falling back to client IP).
 */
export async function checkRateLimit(
  name: LimiterName,
  identifier: string
): Promise<RateLimitResult> {
  const tier = TIERS[name];
  const limiter = getLimiter(name);

  if (!limiter) {
    if (isProduction) {
      // Fail closed: no rate limit backend means no privileged traffic.
      return { success: false, limit: tier.limit, remaining: 0, reset: Date.now() + windowMs(tier.window), degraded: true };
    }
    return memoryLimit(name, `${tier.prefix}:${identifier}`);
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      degraded: false,
    };
  } catch (error) {
    if (isProduction) {
      console.error(`[ratelimit] ${name} backend error, failing closed`, error);
      return { success: false, limit: tier.limit, remaining: 0, reset: Date.now() + windowMs(tier.window), degraded: true };
    }
    console.warn(`[ratelimit] ${name} backend error, using memory fallback`, error);
    return memoryLimit(name, `${tier.prefix}:${identifier}`);
  }
}

/** Standard headers so clients can back off instead of hammering. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))),
  };
}

function formatRetry(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (!hours || secs) parts.push(`${secs} second${secs === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function rateLimitResponse(result: RateLimitResult, limiter?: LimiterName): Response {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  const messages: Partial<Record<LimiterName, string>> = {
    panVerify: "You have used today's PAN checks (three per day). Try again tomorrow — each lookup is paid.",
    kycSession: "You have started identity verification too many times this hour. Try again later.",
    otpSend: `You have requested too many codes. You can send another in ${formatRetry(retryAfter)}.`,
    otpVerify: "Too many code checks. Request a new code in a little while.",
    contact: "Too many contact messages from this network. Please wait a bit, then try again.",
    donate: "Too many gift attempts from this network. Please wait a bit, then try again.",
  };
  return Response.json(
    {
      error: "rate_limited",
      retryable: true,
      message: result.degraded
        ? "Rate limiting backend unavailable; request rejected."
        : (limiter ? messages[limiter] : undefined) ?? "Too many requests. Please try again later.",
      retryAfter,
    },
    { status: 429, headers: { ...rateLimitHeaders(result), "Retry-After": String(retryAfter) } }
  );
}
