import { KycStatus, PanStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  maskLast4,
  otpCountsFromActions,
  summariseUserVerification,
} from "@/lib/verification-summary";

describe("maskLast4", () => {
  it("keeps only the last four digits", () => {
    expect(maskLast4("919876543210")).toBe("····3210");
    expect(maskLast4("12")).toBeNull();
  });
});

describe("otpCountsFromActions", () => {
  it("sums audit action counts", () => {
    expect(
      otpCountsFromActions([
        { action: "otp.sent", count: 2 },
        { action: "otp.verified", count: 1 },
        { action: "otp.failed", count: 3 },
      ])
    ).toEqual({ sent: 2, verified: 1, failed: 3 });
  });
});

describe("summariseUserVerification", () => {
  it("shows Didit and APITXT when those records exist", () => {
    const summary = summariseUserVerification({
      kycStatus: KycStatus.APPROVED,
      phone: null,
      kyc: [{ status: KycStatus.APPROVED, createdAt: new Date() }],
      pan: [
        {
          status: PanStatus.VERIFIED,
          panLast4: "8208",
          nameMatch: true,
          dobMatch: true,
          createdAt: new Date(),
        },
      ],
      otp: { sent: 0, verified: 0, failed: 0 },
    });

    expect(summary.methodsPassed).toBe(2);
    expect(summary.totalAttempts).toBe(2);
    expect(summary.methods.find((m) => m.id === "didit")?.headline).toBe("Approved");
    expect(summary.methods.find((m) => m.id === "pan")?.headline).toBe("Verified · ····8208");
    expect(summary.methods.find((m) => m.id === "otp")?.headline).toBe("Not started");
  });

  it("counts failed PAN tries and OTP codes", () => {
    const summary = summariseUserVerification({
      kycStatus: KycStatus.NOT_STARTED,
      phone: "9876543210",
      kyc: [],
      pan: [
        {
          status: PanStatus.FAILED,
          panLast4: "1111",
          nameMatch: false,
          dobMatch: false,
          createdAt: new Date(),
        },
        {
          status: PanStatus.FAILED,
          panLast4: "1111",
          nameMatch: false,
          dobMatch: false,
          createdAt: new Date(),
        },
      ],
      otp: { sent: 2, verified: 1, failed: 1 },
    });

    expect(summary.methods.find((m) => m.id === "pan")?.headline).toBe("Failed · 2 tries");
    expect(summary.methods.find((m) => m.id === "otp")?.headline).toBe("Verified · ····3210");
    expect(summary.methodsPassed).toBe(1);
  });
});
