import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "crypto";
import { hmacSha256Hex, safeEqualHex } from "./crypto";
import { env, isProduction } from "./env";
import { getRedisClient } from "./ratelimit";

const TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;

type Pending = {
  stage: "otp" | "ready";
  otpHash: string;
  setupHash: string;
  attempts: number;
  expiresAt: number;
  firstName: string | null;
};

const memory = new Map<string, Pending>();

export function mobileAccountEmail(phone10: string): string {
  return `${phone10}@mobile.theainf.in`;
}

export function indianMobile(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export function e164India(phone10: string): string {
  return `+91${phone10}`;
}

export function passwordOk(value: string): boolean {
  return value.length >= 8 && value.length <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

function pepper(): string {
  return env.CLERK_SECRET_KEY || env.PAN_HASH_SALT || "dev-mobile-auth";
}

function keyFor(phone10: string) {
  return `mobile-reg:${phone10}`;
}

function sealKey(): Buffer {
  return createHash("sha256").update(`ainf-mobile-reg\0${pepper()}`, "utf8").digest();
}

export function sealPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openPassword(seal: string): string | null {
  try {
    const raw = Buffer.from(seal, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function hashOtp(phone10: string, code: string) {
  return hmacSha256Hex(pepper(), `mobile:${phone10}:${code}`);
}

async function read(phone10: string): Promise<Pending | null> {
  const redis = getRedisClient();
  if (redis) return (await redis.get<Pending>(keyFor(phone10))) ?? null;
  if (isProduction) return null;
  const row = memory.get(phone10);
  if (!row || row.expiresAt < Date.now()) {
    memory.delete(phone10);
    return null;
  }
  return row;
}

async function write(phone10: string, row: Pending): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(keyFor(phone10), row, { ex: TTL_SECONDS });
    return;
  }
  if (isProduction) throw new Error("Mobile registration requires Redis in production");
  memory.set(phone10, row);
}

async function clear(phone10: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.del(keyFor(phone10));
    return;
  }
  memory.delete(phone10);
}

export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function beginMobileRegistration(input: {
  phone10: string;
  firstName: string | null;
  code: string;
}): Promise<void> {
  await write(input.phone10, {
    stage: "otp",
    otpHash: hashOtp(input.phone10, input.code),
    setupHash: "",
    attempts: 0,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
    firstName: input.firstName,
  });
}

export async function acceptMobileOtp(
  phone10: string,
  code: string
): Promise<{ ok: true; setupToken: string } | { ok: false; reason: "missing" | "mismatch" | "locked" }> {
  const stored = await read(phone10);
  if (!stored || stored.stage !== "otp") return { ok: false, reason: "missing" };
  if (stored.attempts >= MAX_ATTEMPTS) {
    await clear(phone10);
    return { ok: false, reason: "locked" };
  }
  if (!safeEqualHex(stored.otpHash, hashOtp(phone10, code.trim()))) {
    stored.attempts += 1;
    await write(phone10, stored);
    return { ok: false, reason: "mismatch" };
  }
  const setupToken = randomBytes(24).toString("base64url");
  await write(phone10, {
    ...stored,
    stage: "ready",
    otpHash: "",
    setupHash: hmacSha256Hex(pepper(), `setup:${phone10}:${setupToken}`),
    attempts: 0,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
  return { ok: true, setupToken };
}

export async function claimMobilePassword(
  phone10: string,
  setupToken: string
): Promise<{ ok: true; firstName: string | null } | { ok: false; reason: "missing" | "mismatch" | "locked" }> {
  const stored = await read(phone10);
  if (!stored || stored.stage !== "ready" || !stored.setupHash) return { ok: false, reason: "missing" };
  if (stored.attempts >= MAX_ATTEMPTS) {
    await clear(phone10);
    return { ok: false, reason: "locked" };
  }
  const match = safeEqualHex(stored.setupHash, hmacSha256Hex(pepper(), `setup:${phone10}:${setupToken}`));
  if (!match) {
    stored.attempts += 1;
    await write(phone10, stored);
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true, firstName: stored.firstName };
}

export async function completeMobileRegistration(phone10: string): Promise<void> {
  await clear(phone10);
}
