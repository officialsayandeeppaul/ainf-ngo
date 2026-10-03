import type { Prisma } from "@prisma/client";
import { AuditAction } from "./audit-actions";

const ACTION_LABEL: Record<string, string> = {
  [AuditAction.UserCreated]: "User created",
  [AuditAction.UserUpdated]: "User updated",
  [AuditAction.UserDeleted]: "User deleted",
  [AuditAction.RoleChanged]: "Role changed",
  [AuditAction.UserSuspended]: "User suspended",
  [AuditAction.UserReinstated]: "User reinstated",
  [AuditAction.KycSessionCreated]: "Didit session",
  [AuditAction.KycStatusChanged]: "Didit status",
  [AuditAction.KycManualReview]: "Didit review",
  [AuditAction.KycWebhookRejected]: "Didit webhook rejected",
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
  [AuditAction.RazorpayWebhookRejected]: "Razorpay webhook rejected",
  [AuditAction.ContactMessageReceived]: "Contact message",
  [AuditAction.ContactMessageReviewed]: "Contact reviewed",
  [AuditAction.ContactMessageReplied]: "Contact reply",
  [AuditAction.ContactMessageArchived]: "Contact archived",
  [AuditAction.ContactMessageReopened]: "Contact reopened",
  [AuditAction.SupportBannerUpdated]: "Support banner",
  [AuditAction.FieldProjectSaved]: "Project updated",
  [AuditAction.DonationSettingsUpdated]: "Gift settings",
  [AuditAction.DonationMissionSaved]: "Gift mission",
  [AuditAction.DonationCaptured]: "Gift paid",
  [AuditAction.DonationRefunded]: "Gift returned",
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
};

export type AuditChip = { label: string; value: string };

export function auditActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/[._]/g, " ");
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
    const value = typeof raw === "boolean" ? (raw ? "yes" : "no") : String(raw);
    chips.push({
      label: META_LABEL[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value: key === "panLast4" ? `····${value}` : value,
    });
    if (chips.length >= limit) break;
  }
  return chips;
}
