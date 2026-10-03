import { describe, expect, it } from "vitest";
import { buildTextOtpParams } from "@/lib/apitxt";
import {
  acceptMobileOtp,
  beginMobileRegistration,
  claimMobilePassword,
  completeMobileRegistration,
  indianMobile,
  newOtpCode,
  passwordOk,
} from "@/lib/mobile-auth";

describe("text OTP request", () => {
  it("sends the code without a DLT template, sender, or PE id", () => {
    const built = buildTextOtpParams({ mobile: "9876543210", otp: "123456" });
    expect(built).toBeInstanceOf(URLSearchParams);
    const params = built as URLSearchParams;
    expect(params.get("mobile")).toBe("919876543210");
    expect(params.get("otp")).toBe("123456");
    expect(params.get("channel")).toBe("sms");
    expect(params.get("authkey")).toBe("test_otp_key");
    expect(params.get("template_id")).toBeNull();
    expect(params.get("pe_id")).toBeNull();
    expect(params.get("sender")).toBeNull();
  });

  it("accepts a number that already includes 91", () => {
    const built = buildTextOtpParams({ mobile: "+91 98765 43210", otp: "000111" });
    expect((built as URLSearchParams).get("mobile")).toBe("919876543210");
  });
});

describe("mobile registration rules", () => {
  it("accepts an Indian mobile and a password with a letter and a number", () => {
    expect(indianMobile("9876543210")).toBe("9876543210");
    expect(indianMobile("09876543210")).toBe("9876543210");
    expect(indianMobile("12345")).toBeNull();
    expect(passwordOk("correcthorse12x")).toBe(true);
    expect(passwordOk("correct1")).toBe(true);
    expect(passwordOk("short1")).toBe(false);
    expect(passwordOk("longpassword")).toBe(false);
  });

  it("opens the password step only after the text code matches", async () => {
    const code = "654321";
    await beginMobileRegistration({
      phone10: "9123456789",
      firstName: "Ada",
      code,
    });
    expect((await acceptMobileOtp("9123456789", "000000")).ok).toBe(false);
    expect((await claimMobilePassword("9123456789", "not-a-token")).ok).toBe(false);
    const accepted = await acceptMobileOtp("9123456789", code);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect((await acceptMobileOtp("9123456789", code)).ok).toBe(false);
    const claimed = await claimMobilePassword("9123456789", accepted.setupToken);
    expect(claimed.ok).toBe(true);
    if (claimed.ok) expect(claimed.firstName).toBe("Ada");
    await completeMobileRegistration("9123456789");
    expect((await claimMobilePassword("9123456789", accepted.setupToken)).ok).toBe(false);
    expect(newOtpCode()).toMatch(/^\d{6}$/);
  });
});
