import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of two hex-encoded digests.
 *
 * timingSafeEqual throws when lengths differ, which would itself leak length
 * information through the exception path, so the inputs are hashed to a fixed
 * width first. That keeps the comparison constant-time for any input.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const left = createHash("sha256").update(a.trim().toLowerCase()).digest();
  const right = createHash("sha256").update(b.trim().toLowerCase()).digest();
  return timingSafeEqual(left, right);
}

/** Constant-time comparison of two secrets of arbitrary length. */
export function safeEqualSecret(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Canonical JSON used by Didit's X-Signature-V2 scheme: keys sorted at every
 * level, compact separators, and non-ASCII characters preserved rather than
 * escaped (Python's json.dumps with ensure_ascii=False).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 of a sensitive identifier plus a server-held salt. */
export function saltedHash(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value.trim().toUpperCase()}`).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
