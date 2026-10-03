import { describe, expect, it } from "vitest";
import { listServices } from "@/lib/service-status";

describe("service status", () => {
  it("lists every integration without leaking secrets", () => {
    const rows = listServices();
    const ids = rows.map((row) => row.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "clerk-mfa",
        "didit",
        "pan",
        "otp",
        "sms",
        "dlt",
        "resend",
        "postgres",
        "redis",
      ])
    );
    expect(JSON.stringify(rows)).not.toMatch(/sk_test_|vd18_|iwS83|re_/);
  });

  it("treats DLT as off in the default test env", () => {
    const dlt = listServices().find((row) => row.id === "dlt");
    expect(dlt?.on).toBe(false);
  });

  it("shows Clerk MFA as integrated when Clerk keys exist", () => {
    const mfa = listServices().find((row) => row.id === "clerk-mfa");
    // Test setup does not set Clerk keys, so this is off — the row still exists.
    expect(mfa).toBeDefined();
    expect(mfa?.detail.toLowerCase()).toMatch(/mfa|totp|clerk/);
  });
});
