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
      { label: "To", value: "Super admin" },
      { label: "From", value: "Member" },
      { label: "MFA", value: "no" },
    ]);
  });

  it("never shows codes, ids or raw times to an admin", () => {
    expect(
      auditChips(
        {
          previousKyc: "NOT_STARTED",
          reason: "admin_identity",
          targetUserId: "cmvweo3r470c8ab590262abc",
          amountPaise: 50000,
          expiresAt: "2026-11-30T18:30:00.000Z",
          someNewFlag: "LINK_SENT",
        },
        10
      )
    ).toEqual([
      { label: "Identity before", value: "Not started" },
      { label: "Reason", value: "Verified by an admin" },
      { label: "Amount", value: "₹500" },
      { label: "Ends", value: "01 Dec 2026, 00:00" },
      { label: "Some new flag", value: "Link sent" },
    ]);
  });

  it("labels unknown actions in sentence case", () => {
    expect(auditActionLabel("user.message_sent")).toBe("Message to their dashboard");
    expect(auditActionLabel("something.brand_new")).toBe("Something brand new");
  });
});
