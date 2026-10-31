import { describe, expect, it } from "vitest";
import { isMobileDigits, mobileDigits } from "@/components/portal/PhoneField";
import { CARD_ADDRESS_MAX, CARD_FATHER_NAME_MAX } from "@/lib/card-fields";
import { cardMobile } from "@/lib/membership-card";
import { fitCardValue, renderFrontSvg } from "@/lib/membership-card-art";

describe("mobile number box", () => {
  it("keeps the ten local digits from typed, pasted and stored numbers", () => {
    expect(mobileDigits("9876543210")).toBe("9876543210");
    expect(mobileDigits("+91 98765 43210")).toBe("9876543210");
    expect(mobileDigits("+919876543210")).toBe("9876543210");
    expect(mobileDigits("09876543210")).toBe("9876543210");
    expect(mobileDigits("98765-432")).toBe("98765432");
    expect(mobileDigits("98765432101234")).toBe("9876543210");
    expect(mobileDigits(null)).toBe("");
  });

  it("does not strip 91 from a number that starts with it", () => {
    expect(mobileDigits("9123456789")).toBe("9123456789");
    expect(mobileDigits("91234567890")).toBe("9123456789");
  });

  it("accepts only Indian mobiles", () => {
    expect(isMobileDigits("9876543210")).toBe(true);
    expect(isMobileDigits("6000000000")).toBe(true);
    expect(isMobileDigits("5876543210")).toBe(false);
    expect(isMobileDigits("987654321")).toBe(false);
  });

  it("prints +91 and ten digits on the card", () => {
    expect(cardMobile("+919876543210")).toBe("+91 9876543210");
    expect(cardMobile("9876543210")).toBe("+91 9876543210");
    expect(cardMobile("+91 9876543210")).toBe("+91 9876543210");
    expect(cardMobile(null)).toBe("—");
  });
});

describe("card values fit beside the photo", () => {
  it("leaves short values at full size", () => {
    expect(fitCardValue("ADA LOVELACE")).toEqual({ text: "ADA LOVELACE", size: 28 });
  });

  it("sets a long value smaller instead of cutting it", () => {
    const father = "RAMESH CHANDRA BHATTACHARYA CHOWDHURY";
    const fit = fitCardValue(father);
    expect(fit.text).toBe(father);
    expect(fit.size).toBeLessThan(28);
    expect(fit.size).toBeGreaterThanOrEqual(18);
  });

  it("fits the longest address and father's name the form allows", () => {
    const address = "12/4 NETAJI SUBHAS ROAD, BALLYGUNGE, KOLKATA 700001".slice(0, CARD_ADDRESS_MAX);
    expect(fitCardValue(address).text).toBe(address);
    const father = "SRI RAMKRISHNA PARAMHANSA DEV BHATTACHAR".slice(0, CARD_FATHER_NAME_MAX);
    expect(fitCardValue(father).text).toBe(father);
  });

  it("ends an impossible value in an ellipsis at the smallest size", () => {
    const fit = fitCardValue("W".repeat(60));
    expect(fit.size).toBe(18);
    expect(fit.text.endsWith("…")).toBe(true);
    expect(fit.text.length).toBeLessThan(60);
  });

  it("writes the fitted size into the card", () => {
    const front = renderFrontSvg({
      name: "Ada Lovelace",
      fatherName: "Ramesh Chandra Bhattacharya Chowdhury",
      regNo: "AINF-2026-0007",
      address: "Kolkata",
      designation: "Gold",
      mobile: "+91 9000000001",
      photoUrl: null,
      verifyUrl: "http://localhost:3000/card/verify?c=abcdefghijklmnopqrstuvwx",
      issuedLabel: "1 Jan 2026",
      expiresLabel: "1 Jan 2027",
    });
    expect(front).toContain("RAMESH CHANDRA BHATTACHARYA CHOWDHURY");
    expect(front).not.toContain("RAMESH CHANDRA BHATT…");
    expect(front).toMatch(/font-size="(1[89]|2[0-7])(\.\d)?"[^>]*>RAMESH CHANDRA/);
  });
});
