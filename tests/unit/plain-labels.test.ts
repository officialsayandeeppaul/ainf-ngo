import { describe, expect, it } from "vitest";
import { KycStatus, Role } from "@prisma/client";
import { kycLabel, plainCode } from "@/lib/plain-labels";

describe("plainCode", () => {
  it("gives every identity state and role a plain name", () => {
    for (const status of Object.values(KycStatus)) expect(kycLabel(status)).not.toMatch(/_/);
    for (const role of Object.values(Role)) expect(plainCode(role)).not.toMatch(/_/);
    expect(kycLabel("NOT_STARTED")).toBe("Not started");
    expect(plainCode("VERIFIED_USER")).toBe("Verified member");
  });

  it("turns stored reasons into words", () => {
    expect(plainCode("admin_identity")).toBe("Verified by an admin");
    expect(plainCode("kyc_revoked")).toBe("Identity approval withdrawn");
    expect(plainCode("contact_message")).toBe("Contact message");
    expect(plainCode("SOME_NEW_CODE")).toBe("Some new code");
  });

  it("leaves ordinary text alone", () => {
    expect(plainCode("Wrong document photo")).toBe("Wrong document photo");
    expect(plainCode("PAN")).toBe("PAN");
    expect(plainCode("ainf@example.com")).toBe("ainf@example.com");
  });
});
