import { describe, expect, it } from "vitest";
import {
  amountAllowed,
  identityReadyForMembership,
  isDonationNote,
  joinDestination,
  paymentMatchesGift,
  resolvedFloor,
  safeAccountReturn,
  safeSignInReturn,
  visibleSuggestions,
} from "@/lib/donation-rules";

describe("gift floors", () => {
  it("uses the global minimum when a target has no own floor", () => {
    expect(resolvedFloor(10000, null)).toBe(10000);
    expect(resolvedFloor(10000, undefined)).toBe(10000);
  });

  it("keeps the global minimum as a floor under a lower own amount", () => {
    expect(resolvedFloor(10000, 5000)).toBe(10000);
  });

  it("uses a higher own amount", () => {
    expect(resolvedFloor(10000, 25000)).toBe(25000);
  });

  it("rejects amounts under the floor, over the cap, and non-integers", () => {
    expect(amountAllowed(10000, 10000, 10000000)).toBe(true);
    expect(amountAllowed(9999, 10000, 10000000)).toBe(false);
    expect(amountAllowed(10000001, 10000, 10000000)).toBe(false);
    expect(amountAllowed(10000.5, 10000, 10000000)).toBe(false);
  });

  it("hides suggested amounts outside the floor and cap", () => {
    expect(visibleSuggestions([5000, 50000, 100000, 20000000], 10000, 10000000)).toEqual([
      50000, 100000,
    ]);
  });
});

describe("gift capture", () => {
  it("accepts a captured payment for the stored amount", () => {
    expect(
      paymentMatchesGift({
        storedPaise: 50000,
        paidPaise: 50000,
        currency: "INR",
        status: "captured",
      })
    ).toEqual({ ok: true });
  });

  it("rejects a different amount", () => {
    expect(
      paymentMatchesGift({
        storedPaise: 50000,
        paidPaise: 100,
        currency: "INR",
        status: "captured",
      }).ok
    ).toBe(false);
  });

  it("rejects an uncaptured payment and a non-rupee currency", () => {
    expect(
      paymentMatchesGift({
        storedPaise: 50000,
        paidPaise: 50000,
        currency: "INR",
        status: "created",
      }).ok
    ).toBe(false);
    expect(
      paymentMatchesGift({
        storedPaise: 50000,
        paidPaise: 50000,
        currency: "USD",
        status: "captured",
      }).ok
    ).toBe(false);
  });

  it("recognises a donation note and ignores membership notes", () => {
    expect(isDonationNote({ purpose: "donation", donationId: "abc" })).toBe(true);
    expect(isDonationNote({ userId: "user", tierId: "tier" })).toBe(false);
    expect(isDonationNote(null)).toBe(false);
  });
});

describe("sevak gate", () => {
  const policy = { didit: true, pan: true, otp: false };

  it("requires identity and PAN when both are on", () => {
    expect(identityReadyForMembership({ kycStatus: "APPROVED", panVerified: false }, policy)).toBe(false);
    expect(identityReadyForMembership({ kycStatus: "NOT_STARTED", panVerified: true }, policy)).toBe(false);
    expect(identityReadyForMembership({ kycStatus: "APPROVED", panVerified: true }, policy)).toBe(true);
  });

  it("does not block when no verification method is configured", () => {
    expect(
      identityReadyForMembership(
        { kycStatus: "NOT_STARTED", panVerified: false },
        { didit: false, pan: false, otp: false }
      )
    ).toBe(true);
  });

  it("sends an approved person to the plan and everyone else to verify", () => {
    expect(joinDestination(true)).toBe("/account/membership");
    expect(joinDestination(false)).toBe("/account/verify");
  });

  it("allows only the membership and verify return paths", () => {
    expect(safeAccountReturn("/account/membership")).toBe("/account/membership");
    expect(safeAccountReturn("/account/verify")).toBe("/account/verify");
    expect(safeAccountReturn("/account")).toBe(null);
    expect(safeAccountReturn("//evil.example/account/membership")).toBe(null);
    expect(safeAccountReturn("https://evil.example/account/membership")).toBe(null);
    expect(safeSignInReturn("/admin/gifts")).toBe("/admin/gifts");
    expect(safeSignInReturn("https://evil.example")).toBe("/account");
  });
});
