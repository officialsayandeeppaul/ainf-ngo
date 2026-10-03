import { describe, expect, it } from "vitest";
import { hmacSha256Hex, safeEqualHex, safeEqualSecret, saltedHash } from "@/lib/crypto";

describe("constant-time comparison", () => {
  it("matches identical hex digests", () => {
    const digest = hmacSha256Hex("secret", "message");
    expect(safeEqualHex(digest, digest)).toBe(true);
  });

  it("ignores case and surrounding whitespace in hex", () => {
    const digest = hmacSha256Hex("secret", "message");
    expect(safeEqualHex(digest, digest.toUpperCase())).toBe(true);
    expect(safeEqualHex(digest, ` ${digest} `)).toBe(true);
  });

  it("rejects different digests", () => {
    expect(safeEqualHex(hmacSha256Hex("a", "m"), hmacSha256Hex("b", "m"))).toBe(false);
  });

  it("rejects inputs of different length without throwing", () => {
    // node's timingSafeEqual throws on length mismatch; hashing first avoids
    // both the exception and the length side channel.
    expect(() => safeEqualHex("abc", "abcdef")).not.toThrow();
    expect(safeEqualHex("abc", "abcdef")).toBe(false);
  });

  it("compares arbitrary secrets exactly", () => {
    expect(safeEqualSecret("bootstrap-key", "bootstrap-key")).toBe(true);
    expect(safeEqualSecret("bootstrap-key", "bootstrap-Key")).toBe(false);
    expect(safeEqualSecret("bootstrap-key", "bootstrap-key ")).toBe(false);
    expect(safeEqualSecret("", "")).toBe(true);
    expect(safeEqualSecret("short", "a-much-longer-secret")).toBe(false);
  });
});

describe("HMAC", () => {
  it("produces a stable 64-character hex digest", () => {
    const digest = hmacSha256Hex("k", "v");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacSha256Hex("k", "v")).toBe(digest);
  });

  it("changes with the key and with the message", () => {
    expect(hmacSha256Hex("k1", "v")).not.toBe(hmacSha256Hex("k2", "v"));
    expect(hmacSha256Hex("k", "v1")).not.toBe(hmacSha256Hex("k", "v2"));
  });

  it("treats a string and its bytes identically", () => {
    expect(hmacSha256Hex("k", "hello")).toBe(hmacSha256Hex("k", Buffer.from("hello", "utf8")));
  });
});

describe("salted PAN hashing", () => {
  it("is deterministic for the same PAN and salt", () => {
    expect(saltedHash("ABCDE1234F", "salt")).toBe(saltedHash("ABCDE1234F", "salt"));
  });

  it("normalises case and whitespace so the same PAN always collides", () => {
    const canonical = saltedHash("ABCDE1234F", "salt");
    expect(saltedHash("abcde1234f", "salt")).toBe(canonical);
    expect(saltedHash("  ABCDE1234F  ", "salt")).toBe(canonical);
  });

  it("changes with the salt, so rotating it invalidates old hashes", () => {
    expect(saltedHash("ABCDE1234F", "salt-a")).not.toBe(saltedHash("ABCDE1234F", "salt-b"));
  });

  it("does not leak the PAN into the digest", () => {
    const digest = saltedHash("ABCDE1234F", "salt");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest.toUpperCase()).not.toContain("ABCDE1234F");
  });

  it("distinguishes different PANs", () => {
    expect(saltedHash("ABCDE1234F", "salt")).not.toBe(saltedHash("ABCDE1234G", "salt"));
  });
});
