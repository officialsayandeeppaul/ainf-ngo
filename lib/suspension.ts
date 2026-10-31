import { isMobileAccountEmail } from "./account-contact";
import { formatDayTime } from "./format-date";

/**
 * Suspension rules shared by the admin form, the API, the member's notice and
 * the suspended page. No database or network here, so it is unit-tested.
 */

export const SUSPENSION_PERIODS = [
  { value: "1d", label: "1 day", days: 1 },
  { value: "3d", label: "3 days", days: 3 },
  { value: "7d", label: "7 days", days: 7 },
  { value: "14d", label: "14 days", days: 14 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "indefinite", label: "Until reinstated", days: null },
] as const;

export type SuspensionPeriod = (typeof SUSPENSION_PERIODS)[number]["value"];

export const SUSPENSION_PERIOD_VALUES = SUSPENSION_PERIODS.map((period) => period.value) as [
  SuspensionPeriod,
  ...SuspensionPeriod[],
];

export const SUSPENSION_REASON_MIN = 10;
export const SUSPENSION_REASON_MAX = 400;

/** When the suspension lifts by itself; null means only an admin can lift it. */
export function suspendedUntilFor(period: SuspensionPeriod, now: Date = new Date()): Date | null {
  const days = SUSPENSION_PERIODS.find((entry) => entry.value === period)?.days ?? null;
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** True once a timed suspension has run its course. Bans never lift by themselves. */
export function suspensionHasEnded(
  user: { status: string; suspendedUntil: Date | null },
  now: Date = new Date()
): boolean {
  return user.status === "SUSPENDED" && user.suspendedUntil !== null && user.suspendedUntil.getTime() <= now.getTime();
}

/** "until 07 Nov 2026, 15:00 (India time)" or "until AINF reinstates it". */
export function suspensionEndLabel(until: Date | null): string {
  return until ? `until ${formatDayTime(until)} (India time)` : "until AINF reinstates it";
}

/**
 * How to tell a member about their account. People who signed up with a
 * mobile number carry a placeholder address, so they get an SMS instead.
 */
export function suspensionNoticeChannel(user: { email: string; phone: string | null }): "email" | "sms" | null {
  if (!isMobileAccountEmail(user.email)) return "email";
  return user.phone && user.phone.replace(/\D/g, "").length >= 10 ? "sms" : null;
}

/** One SMS segment where possible; the reason is shortened to fit, never the dates. */
export function suspensionSmsText(input: { reason: string; until: Date | null }): string {
  const head = `AINF: Your account is suspended ${suspensionEndLabel(input.until).replace(" (India time)", " IST")}. Reason: `;
  const tail = " Contact hello@theainf.in";
  // 300 characters at most; the 1 is the full stop after the reason.
  const room = Math.max(20, 300 - head.length - tail.length - 1);
  const reason = input.reason.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  const clipped = reason.length > room ? `${reason.slice(0, room - 1).trimEnd()}…` : reason;
  return `${head}${clipped}.${tail}`;
}

export function reinstatedSmsText(): string {
  return "AINF: Your account is active again. You can sign in at theainf.in. Contact hello@theainf.in";
}

/**
 * Ways an admin can tell a member themselves when email or SMS cannot reach
 * them (no DLT template for SMS, email in test mode): WhatsApp or email from
 * their own phone or inbox, a call, or anything else they note down.
 */
export const MANUAL_NOTICE_CHANNELS = ["whatsapp", "call", "email", "other"] as const;
export type ManualNoticeChannel = (typeof MANUAL_NOTICE_CHANNELS)[number];

const CHANNEL_LABEL: Record<string, string> = {
  email: "email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  call: "phone call",
  other: "another way",
};

/** "WhatsApp", "email", "phone call"… for "Told by …". */
export function noticeChannelLabel(channel: string | null | undefined): string {
  return (channel && CHANNEL_LABEL[channel]) || "another way";
}

/** Why the automatic notice did not go, in words an admin can act on. */
export function noticeErrorLabel(error: string | null | undefined): string | null {
  if (!error) return null;
  if (error === "no_contact") return "There is no email or mobile number on this account.";
  if (error === "sms_template_missing")
    return "Text messages need a DLT template registered for this notice, so no SMS was sent.";
  if (error === "not_configured" || error === "no_sender_id") return "Text messages are not set up on this site.";
  if (/test mode/i.test(error)) return "Email sending is in test mode, so the email only reaches the AINF inbox.";
  if (error === "invalid_number") return "The mobile number on this account is not valid.";
  return "The automatic message could not be delivered.";
}

/** The full message for WhatsApp, email drafts and copying. No length limit, unlike the SMS. */
export function suspensionMessage(input: { firstName: string | null; reason: string; until: Date | null }): string {
  const name = input.firstName?.trim() || "there";
  const reason = input.reason.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  return [
    `Hello ${name},`,
    "",
    `This is AINF (All Indian Nevarlands Foundation). Your AINF account has been suspended ${suspensionEndLabel(input.until)}.`,
    "",
    `Reason: ${reason || "not recorded"}.`,
    "",
    "While it is suspended you cannot use member services. You can still sign in at theainf.in to see these details. If you think this is a mistake, reply to this message or write to hello@theainf.in.",
  ].join("\n");
}

export function reinstatedMessage(firstName: string | null): string {
  const name = firstName?.trim() || "there";
  return `Hello ${name},\n\nThis is AINF. Your AINF account is active again, and you can sign in at theainf.in as usual. Thank you for your patience.`;
}

/** The current suspension as the admin screens need it (dates as ISO strings for client components). */
export function suspensionForAdmin(user: {
  status: string;
  suspendedReason: string | null;
  suspendedUntil: Date | null;
  suspensionNoticeChannel: string | null;
  suspensionNoticeSentAt: Date | null;
}): { reason: string | null; until: string | null; notice: { channel: string | null; sentAt: string | null } } | null {
  if (user.status === "ACTIVE") return null;
  return {
    reason: user.suspendedReason,
    until: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    notice: {
      channel: user.suspensionNoticeChannel,
      sentAt: user.suspensionNoticeSentAt ? user.suspensionNoticeSentAt.toISOString() : null,
    },
  };
}
