import { describe, expect, it } from "vitest";
import { auditActionLabel, auditChips, shortId } from "@/lib/audit-display";

describe("auditActionLabel", () => {
  it("turns machine actions into short labels", () => {
    expect(auditActionLabel("user.role_changed")).toBe("Role changed");
    expect(auditActionLabel("admin.bootstrap_succeeded")).toBe("Became super admin");
    expect(auditActionLabel("membership.expired")).toBe("Membership ended");
    expect(auditActionLabel("membership.cancel_at_period_end")).toBe("Renewal cancelled");
    expect(auditActionLabel("membership.card_issued")).toBe("ID card issued");
  });
});

describe("shortId", () => {
  it("clips long ids", () => {
    expect(shortId("cmtjlqjnr000g04i3d57xp9h7")).toBe("cmtjlqjn…");
    expect(shortId("user")).toBe("user");
  });
});

describe("auditChips", () => {
  it("skips objects and formats booleans", () => {
    expect(
      auditChips({
        to: "SUPER_ADMIN",
        from: "USER",
        mfaEnrolled: false,
        nested: { skip: true },
      })
    ).toEqual([
      { label: "To", value: "SUPER_ADMIN" },
      { label: "From", value: "USER" },
      { label: "MFA", value: "no" },
    ]);
  });
});
