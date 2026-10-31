import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  env: { APITXT_DLT_SUSPEND_TEMPLATE_ID: undefined as string | undefined },
  sendSms: vi.fn(async () => ({ sent: true, error: null })),
  sendSuspendedEmail: vi.fn(async () => ({ sent: true })),
}));

vi.mock("@/lib/env", () => ({ env: h.env }));
vi.mock("@/lib/apitxt", () => ({ sendSms: h.sendSms }));
vi.mock("@/lib/email", () => ({
  sendAccountSuspendedEmail: h.sendSuspendedEmail,
  sendAccountReinstatedEmail: vi.fn(async () => ({ sent: true })),
}));

import { contactLine, displayPhone, isMobileAccountEmail, telHref, whatsappHref } from "@/lib/account-contact";
import { sendSuspensionNotice } from "@/lib/suspension-notice";
import {
  DASHBOARD_NOTICE_CHANNEL,
  manualNoticeOptions,
  noticeChannelLabel,
  noticeErrorLabel,
  noticeStatusLabel,
  suspensionForAdmin,
  suspensionMessage,
} from "@/lib/suspension";

const mobileUser = { email: "9876543210@mobile.theainf.in", phone: "+919876543210", firstName: "Mina" };
const emailUser = { email: "mina@example.com", phone: null, firstName: "Mina" };

describe("how a member is reached", () => {
  it("shows the mobile, not the placeholder address, for mobile sign-ups", () => {
    expect(isMobileAccountEmail("9876543210@mobile.theainf.in")).toBe(true);
    expect(isMobileAccountEmail("mina@example.com")).toBe(false);
    expect(contactLine(mobileUser)).toBe("+91 9876543210");
    expect(contactLine({ email: "9876543210@mobile.theainf.in", phone: null })).toBe("+91 9876543210");
    expect(contactLine(emailUser)).toBe("mina@example.com");
    expect(displayPhone("9876543210")).toBe("+91 9876543210");
  });

  it("builds WhatsApp and call links for Indian mobiles", () => {
    expect(whatsappHref("+919876543210", "Hello there")).toBe("https://wa.me/919876543210?text=Hello%20there");
    expect(whatsappHref("9876543210", "Hi")).toBe("https://wa.me/919876543210?text=Hi");
    expect(whatsappHref("+44 7911 123456", "Hi")).toBe("https://wa.me/447911123456?text=Hi");
    expect(whatsappHref(null, "Hi")).toBeNull();
    expect(whatsappHref("12345", "Hi")).toBeNull();
    expect(telHref("+919876543210")).toBe("tel:+919876543210");
    expect(telHref(null)).toBeNull();
  });
});

describe("the message an admin sends", () => {
  it("says why and until when, and how to reach AINF", () => {
    const text = suspensionMessage({
      firstName: "Mina",
      reason: "The membership payment was reversed by the bank. ",
      until: new Date("2026-11-07T06:30:00.000Z"),
    });
    expect(text).toContain("Hello Mina,");
    expect(text).toContain("suspended until 07 Nov 2026, 12:00 (India time)");
    expect(text).toContain("Reason: The membership payment was reversed by the bank.");
    expect(text).toContain("hello@theainf.in");
    expect(suspensionMessage({ firstName: null, reason: "x".repeat(10), until: null })).toContain(
      "until AINF reinstates it"
    );
  });

  it("names channels and explains failures in plain words", () => {
    expect(noticeChannelLabel("whatsapp")).toBe("WhatsApp");
    expect(noticeChannelLabel("sms")).toBe("SMS");
    expect(noticeChannelLabel("call")).toBe("phone call");
    expect(noticeErrorLabel("sms_template_missing")).toMatch(/DLT template/);
    expect(noticeErrorLabel("Test mode (onboarding@resend.dev): Resend only delivers…")).toMatch(/test mode/);
    expect(noticeErrorLabel("no_contact")).toMatch(/no email or mobile/);
    expect(noticeErrorLabel(null)).toBeNull();
  });

  it("says when the member saw it on their dashboard", () => {
    expect(noticeStatusLabel(DASHBOARD_NOTICE_CHANNEL)).toBe("Seen at sign-in");
    expect(noticeStatusLabel("whatsapp")).toBe("Told by WhatsApp");
    expect(noticeStatusLabel("email")).toBe("Told by email");
  });

  it("offers only the ways that can reach this member", () => {
    // Mobile sign-up: WhatsApp or a call, never email.
    expect(manualNoticeOptions(mobileUser)).toEqual(["whatsapp", "call", "other"]);
    // Email account without a mobile: no WhatsApp or call.
    expect(manualNoticeOptions(emailUser)).toEqual(["email", "other"]);
    expect(manualNoticeOptions({ ...emailUser, phone: "9876543210" })).toEqual(["whatsapp", "call", "email", "other"]);
  });

  it("hands the admin screens the current suspension only", () => {
    const base = {
      suspendedReason: "Payment reversed",
      suspendedUntil: new Date("2026-11-07T06:30:00.000Z"),
      suspensionNoticeChannel: "whatsapp",
      suspensionNoticeSentAt: new Date("2026-10-31T07:00:00.000Z"),
    };
    expect(suspensionForAdmin({ ...base, status: "ACTIVE" })).toBeNull();
    expect(suspensionForAdmin({ ...base, status: "SUSPENDED" })).toEqual({
      reason: "Payment reversed",
      until: "2026-11-07T06:30:00.000Z",
      notice: { channel: "whatsapp", sentAt: "2026-10-31T07:00:00.000Z" },
    });
  });
});

describe("automatic notice", () => {
  beforeEach(() => {
    h.sendSms.mockClear();
    h.sendSuspendedEmail.mockClear();
    h.env.APITXT_DLT_SUSPEND_TEMPLATE_ID = undefined;
  });

  it("sends no SMS without a DLT template for this notice, and says so", async () => {
    const result = await sendSuspensionNotice(mobileUser, { kind: "suspended", reason: "Payment reversed", until: null });
    expect(result).toEqual({ channel: "sms", sent: false, error: "sms_template_missing" });
    expect(h.sendSms).not.toHaveBeenCalled();
  });

  it("sends the SMS once the template is registered", async () => {
    h.env.APITXT_DLT_SUSPEND_TEMPLATE_ID = "1107000000000000001";
    const result = await sendSuspensionNotice(mobileUser, { kind: "suspended", reason: "Payment reversed", until: null });
    expect(result.sent).toBe(true);
    expect(h.sendSms).toHaveBeenCalledWith(expect.objectContaining({ templateId: "1107000000000000001" }));
  });

  it("emails people who signed up with an email", async () => {
    const result = await sendSuspensionNotice(emailUser, { kind: "suspended", reason: "Payment reversed", until: null });
    expect(result).toEqual({ channel: "email", sent: true, error: null });
    expect(h.sendSuspendedEmail).toHaveBeenCalledTimes(1);
  });
});
