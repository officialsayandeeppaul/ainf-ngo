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

const MOBILE_ACCOUNT_EMAIL = /@mobile\.theainf\.in$/i;

/**
 * How to tell a member about their account. People who signed up with a
 * mobile number carry a placeholder address, so they get an SMS instead.
 */
export function suspensionNoticeChannel(user: { email: string; phone: string | null }): "email" | "sms" | null {
  if (!MOBILE_ACCOUNT_EMAIL.test(user.email.trim())) return "email";
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
