import type { Prisma } from "@prisma/client";
import { AuditAction } from "./audit-actions";
import { formatDayTime } from "./format-date";
import { formatInr } from "./membership";
import { plainCode } from "./plain-labels";

const ACTION_LABEL: Record<string, string> = {
  [AuditAction.UserCreated]: "User created",
  [AuditAction.UserUpdated]: "User updated",
  [AuditAction.UserDeleted]: "User deleted",
  [AuditAction.RoleChanged]: "Role changed",
  [AuditAction.UserSuspended]: "User suspended",
  [AuditAction.UserReinstated]: "User reinstated",
  [AuditAction.SuspensionNoticeSent]: "Member told about suspension",
  [AuditAction.MemberMessageSent]: "Message to their dashboard",
  [AuditAction.KycSessionCreated]: "Didit session",
  [AuditAction.KycStatusChanged]: "Didit status",
  [AuditAction.KycManualReview]: "Didit review",
  [AuditAction.KycWebhookRejected]: "Didit webhook rejected",
  [AuditAction.IdentityVerifiedByAdmin]: "Verified by admin",
  [AuditAction.IdentityAdminVerificationRemoved]: "Admin verification removed",
  [AuditAction.PanVerifyAttempted]: "PAN attempted",
  [AuditAction.PanVerifySucceeded]: "PAN verified",
  [AuditAction.PanVerifyFailed]: "PAN failed",
  [AuditAction.OtpSent]: "OTP sent",
  [AuditAction.OtpVerified]: "OTP verified",
  [AuditAction.OtpFailed]: "OTP failed",
  [AuditAction.BootstrapAttempted]: "Admin bootstrap",
  [AuditAction.BootstrapSucceeded]: "Became super admin",
  [AuditAction.BootstrapRejected]: "Bootstrap rejected",
  [AuditAction.RateLimited]: "Rate limited",
  [AuditAction.AccessDenied]: "Access denied",
  [AuditAction.MembershipTierCreated]: "Plan created",
  [AuditAction.MembershipTierUpdated]: "Plan updated",
  [AuditAction.MembershipTierDeleted]: "Plan deleted",
  [AuditAction.MembershipSettingsUpdated]: "Membership settings",
  [AuditAction.MembershipOrderCreated]: "Membership order",
  [AuditAction.MembershipPaymentCaptured]: "Membership paid",
  [AuditAction.MembershipExpired]: "Membership ended",
  [AuditAction.MembershipCancelled]: "Membership cancelled",
  [AuditAction.MembershipCancelAtPeriodEnd]: "Renewal cancelled",
  [AuditAction.MembershipOfferCreated]: "Offer created",
  [AuditAction.MembershipOfferUpdated]: "Offer updated",
  [AuditAction.MembershipOfferDeleted]: "Offer deleted",
  [AuditAction.MembershipCardIssued]: "ID card issued",
  [AuditAction.MembershipGranted]: "Membership granted",
  [AuditAction.RazorpayWebhookRejected]: "Razorpay webhook rejected",
  [AuditAction.ContactMessageReceived]: "Contact message",
  [AuditAction.ContactMessageReviewed]: "Contact reviewed",
  [AuditAction.ContactMessageReplied]: "Contact reply",
  [AuditAction.ContactMessageArchived]: "Contact archived",
  [AuditAction.ContactMessageReopened]: "Contact reopened",
  [AuditAction.SupportBannerUpdated]: "Support banner",
  [AuditAction.FieldProjectSaved]: "Project updated",
  [AuditAction.DonationSettingsUpdated]: "Donation settings",
  [AuditAction.DonationMissionSaved]: "Donation mission",
  [AuditAction.DonationCaptured]: "Donation paid",
  [AuditAction.DonationRefunded]: "Donation returned",
  [AuditAction.DonationReceiptSent]: "Donation receipt emailed",
  [AuditAction.PaymentsSwitched]: "Payments switched",
  [AuditAction.PaymentInterestRecorded]: "Payment interest saved",
  [AuditAction.PaymentInterestUpdated]: "Payment interest updated",
  [AuditAction.PaymentLinkCreated]: "Payment link sent",
  [AuditAction.PaymentLinkResent]: "Payment link resent",
  [AuditAction.PaymentLinkPaid]: "Payment link paid",
  [AuditAction.PaymentLinkClosed]: "Payment link closed",
};

const META_LABEL: Record<string, string> = {
  email: "Email",
  to: "To",
  from: "From",
  reason: "Reason",
  mfaEnrolled: "MFA",
  selfInflicted: "Self",
  priorSuperAdmins: "Prior admins",
  panLast4: "PAN",
  code: "Code",
  kind: "Kind",
  provisionedBy: "Provisioned",
  name: "Name",
  monthlyPaise: "Monthly",
  yearlyDiscountKind: "Yearly discount",
  interval: "Interval",
  amountPaise: "Amount",
  recurring: "Recurring",
  immediate: "Immediate",
  previousExpiresAt: "Previous end",
  regNo: "Regd. no.",
  tierName: "Plan",
  refreshed: "Refreshed",
  previousKyc: "Identity before",
  previousPan: "PAN before",
  previousStatus: "Status before",
  previousTier: "Plan before",
  kycStatus: "Identity",
  panVerified: "PAN confirmed",
  stillVerified: "Still verified",
  note: "Note",
  source: "Source",
  channel: "Sent by",
  until: "Until",
  expiresAt: "Ends",
  endsAt: "Ends",
  status: "Status",
  sendEmail: "Email chosen",
  emailed: "Emailed",
  emailWarning: "Email note",
  scheme: "Method",
  eventType: "Event",
  purpose: "For",
  attempts: "Attempts",
  creditPaise: "Credit",
  duePaise: "Due",
  nameMatch: "Name matched",
  dobMatch: "Date of birth matched",
  automatic: "Automatic",
  customMessage: "Message",
  badge: "Badge",
  enabled: "On",
  signatureOk: "Signature valid",
  aadhaarSeedingStatus: "Aadhaar linked",
  cancelledMandate: "Auto-pay stopped",
  razorpayPaymentId: "Payment",
  razorpayOrderId: "Order",
  razorpaySubscriptionId: "Subscription",
};

/** Internal ids and signatures mean nothing to an admin reading a timeline. */
const HIDDEN_META = new Set([
  "userId",
  "targetUserId",
  "actorUserId",
  "subjectUserId",
  "membershipTierId",
  "interestId",
  "linkId",
  "emailId",
  "token",
  "actorClerkId",
  "actorRole",
  "razorpaySignature",
  "payloadTrusted",
  "ip",
  "userAgent",
]);

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function chipValue(key: string, raw: string | number | boolean): string {
  if (typeof raw === "boolean") return raw ? "yes" : "no";
  if (typeof raw === "number") return /Paise$/.test(key) ? formatInr(raw) : String(raw);
  if (key === "panLast4") return `····${raw}`;
  if (ISO_TIME.test(raw)) {
    const at = new Date(raw);
    if (!Number.isNaN(at.getTime())) return formatDayTime(at);
  }
  if (/^c[a-z0-9]{20,}$/.test(raw) || /^(?:pay|order|sub|plan)_[A-Za-z0-9]{8,}$/.test(raw)) return shortId(raw);
  return plainCode(raw);
}

export type AuditChip = { label: string; value: string };

export function auditActionLabel(action: string): string {
  const known = ACTION_LABEL[action];
  if (known) return known;
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function auditChips(metadata: Prisma.JsonValue | null, limit = 5): AuditChip[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const chips: AuditChip[] = [];
  for (const [key, raw] of Object.entries(metadata as Record<string, unknown>)) {
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw === "object") continue;
    if (HIDDEN_META.has(key)) continue;
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") continue;
    chips.push({
      label:
        META_LABEL[key] ??
        key
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .replace(/^./, (c) => c.toUpperCase()),
      value: chipValue(key, raw),
    });
    if (chips.length >= limit) break;
  }
  return chips;
}
