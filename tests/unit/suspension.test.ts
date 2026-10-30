import { describe, expect, it } from "vitest";
import {
  SUSPENSION_PERIODS,
  suspendedUntilFor,
  suspensionEndLabel,
  suspensionHasEnded,
  suspensionNoticeChannel,
  suspensionSmsText,
} from "@/lib/suspension";

const now = new Date("2026-10-31T06:30:00.000Z");

describe("suspension periods", () => {
  it("ends a timed suspension the given number of days later", () => {
    expect(suspendedUntilFor("1d", now)?.toISOString()).toBe("2026-11-01T06:30:00.000Z");
    expect(suspendedUntilFor("7d", now)?.toISOString()).toBe("2026-11-07T06:30:00.000Z");
    expect(suspendedUntilFor("90d", now)?.toISOString()).toBe("2027-01-29T06:30:00.000Z");
  });

  it("has no end when it lasts until an admin reinstates", () => {
    expect(suspendedUntilFor("indefinite", now)).toBeNull();
    expect(SUSPENSION_PERIODS.at(-1)?.label).toBe("Until reinstated");
  });

  it("lifts only timed suspensions whose end has passed", () => {
    const until = new Date("2026-10-31T06:00:00.000Z");
    expect(suspensionHasEnded({ status: "SUSPENDED", suspendedUntil: until }, now)).toBe(true);
    expect(suspensionHasEnded({ status: "SUSPENDED", suspendedUntil: new Date("2026-11-01T00:00:00.000Z") }, now)).toBe(false);
    expect(suspensionHasEnded({ status: "SUSPENDED", suspendedUntil: null }, now)).toBe(false);
    expect(suspensionHasEnded({ status: "BANNED", suspendedUntil: until }, now)).toBe(false);
    expect(suspensionHasEnded({ status: "ACTIVE", suspendedUntil: until }, now)).toBe(false);
  });

  it("says when it ends in India time", () => {
    expect(suspensionEndLabel(new Date("2026-11-07T06:30:00.000Z"))).toBe("until 07 Nov 2026, 12:00 (India time)");
    expect(suspensionEndLabel(null)).toBe("until AINF reinstates it");
  });
});

describe("suspension notice", () => {
  it("emails people who signed up with email, and texts mobile-number accounts", () => {
    expect(suspensionNoticeChannel({ email: "mina@example.com", phone: "+919876543210" })).toBe("email");
    expect(suspensionNoticeChannel({ email: "9876543210@mobile.theainf.in", phone: "+919876543210" })).toBe("sms");
    expect(suspensionNoticeChannel({ email: "9876543210@mobile.theainf.in", phone: null })).toBeNull();
  });

  it("puts the reason and the end in the SMS, shortening only the reason", () => {
    const short = suspensionSmsText({ reason: "Payment was reversed by the bank.", until: new Date("2026-11-07T06:30:00.000Z") });
    expect(short).toBe(
      "AINF: Your account is suspended until 07 Nov 2026, 12:00 IST. Reason: Payment was reversed by the bank. Contact hello@theainf.in"
    );
    const long = suspensionSmsText({ reason: "x".repeat(500), until: null });
    expect(long.length).toBeLessThanOrEqual(300);
    expect(long).toContain("until AINF reinstates it");
    expect(long).toContain("…");
    expect(long.endsWith("Contact hello@theainf.in")).toBe(true);
  });
});
