import { randomInt } from "node:crypto";
import { hmacSha256Hex, safeEqualHex } from "./crypto";
import { env, isProduction } from "./env";
import { getRedisClient } from "./ratelimit";

const TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;

type StoredOtp = { hash: string; attempts: number; phoneLast4: string; expiresAt: number };

const memory = new Map<string, StoredOtp>();

function pepper(): string {
  return env.PAN_HASH_SALT || env.CLERK_SECRET_KEY || "dev-otp-pepper";
}

function keyFor(userId: string) {
  return `otp:${userId}`;
}

function hashCode(userId: string, code: string) {
  return hmacSha256Hex(pepper(), `${userId}:${code}`);
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

export function isValidIndianMobile(value: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(value));
}

async function read(userId: string): Promise<StoredOtp | null> {
  const redis = getRedisClient();
  if (redis) {
    const value = await redis.get<StoredOtp>(keyFor(userId));
    return value ?? null;
  }
  if (isProduction) return null;
  const row = memory.get(userId);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    memory.delete(userId);
    return null;
  }
  return row;
}

async function write(userId: string, row: StoredOtp): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(keyFor(userId), row, { ex: TTL_SECONDS });
    return;
  }
  if (isProduction) throw new Error("OTP store requires Redis in production");
  memory.set(userId, row);
}

async function clear(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(keyFor(userId));
    return;
  }
  memory.delete(userId);
}

export async function issueOtp(userId: string, phone: string): Promise<{ code: string; last4: string }> {
  const code = generateOtpCode();
  const last4 = phone.slice(-4);
  await write(userId, {
    hash: hashCode(userId, code),
    attempts: 0,
    phoneLast4: last4,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
  return { code, last4 };
}

export async function consumeOtp(
  userId: string,
  code: string
): Promise<{ ok: true } | { ok: false; reason: "missing" | "mismatch" | "locked" }> {
  const stored = await read(userId);
  if (!stored) return { ok: false, reason: "missing" };
  if (stored.attempts >= MAX_ATTEMPTS) {
    await clear(userId);
    return { ok: false, reason: "locked" };
  }
  const match = safeEqualHex(stored.hash, hashCode(userId, code.trim()));
  if (!match) {
    stored.attempts += 1;
    await write(userId, stored);
    return { ok: false, reason: "mismatch" };
  }
  await clear(userId);
  return { ok: true };
}
