import { describe, expect, it } from "vitest";
import { getVerificationPolicy, resolveVerificationPolicy } from "@/lib/verification-policy";

/**
 * Test env (tests/unit/setup.ts) provides Didit and APITXT keys and does not
 * set the override flags, so auto-mode should enable Didit + PAN and leave
 * OTP off.
 */
describe("verification policy (auto)", () => {
  it("enables Didit and PAN when their keys exist", () => {
    const policy = getVerificationPolicy();
    expect(policy.didit).toBe(true);
    expect(policy.pan).toBe(true);
    expect(policy.otp).toBe(false);
  });
});

describe("resolveVerificationPolicy", () => {
  const base = {
    diditConfigured: true,
    panConfigured: true,
    hasSms: false,
    hasEmail: true,
  };

  it("turns OTP on automatically when Didit and PAN are both off", () => {
    const policy = resolveVerificationPolicy({
      ...base,
      diditConfigured: false,
      panConfigured: false,
    });
    expect(policy).toMatchObject({ didit: false, pan: false, otp: true, otpChannel: "email" });
  });

  it("hides Didit and PAN when flags are false even if keys exist", () => {
    const policy = resolveVerificationPolicy({
      ...base,
      diditFlag: "false",
      panFlag: "false",
    });
    expect(policy.didit).toBe(false);
    expect(policy.pan).toBe(false);
    expect(policy.otp).toBe(true);
  });

  it("keeps PAN-only when Didit is forced off", () => {
    const policy = resolveVerificationPolicy({
      ...base,
      diditFlag: "false",
    });
    expect(policy).toMatchObject({ didit: false, pan: true, otp: false });
  });

  it("uses SMS when a sender id is configured", () => {
    const policy = resolveVerificationPolicy({
      diditConfigured: false,
      panConfigured: false,
      hasSms: true,
      hasEmail: true,
    });
    expect(policy.otpChannel).toBe("sms");
  });

  it("reports no OTP channel when neither SMS nor email can send", () => {
    const policy = resolveVerificationPolicy({
      diditConfigured: false,
      panConfigured: false,
      hasSms: false,
      hasEmail: false,
    });
    expect(policy.otp).toBe(true);
    expect(policy.otpChannel).toBe("none");
  });

  it("can force OTP off even when Didit and PAN are off", () => {
    const policy = resolveVerificationPolicy({
      diditConfigured: false,
      panConfigured: false,
      otpFlag: "false",
      hasSms: true,
      hasEmail: true,
    });
    expect(policy.otp).toBe(false);
  });
});
