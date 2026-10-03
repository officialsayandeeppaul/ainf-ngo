/**
 * Audit action names only — safe to import from client code.
 * Persistence lives in `lib/audit.ts` (server).
 */
export const AuditAction = {
  UserCreated: "user.created",
  UserUpdated: "user.updated",
  UserDeleted: "user.deleted",
  RoleChanged: "user.role_changed",
  UserSuspended: "user.suspended",
  UserReinstated: "user.reinstated",

  KycSessionCreated: "kyc.session_created",
  KycStatusChanged: "kyc.status_changed",
  KycManualReview: "kyc.manual_review",
  KycWebhookRejected: "kyc.webhook_rejected",

  PanVerifyAttempted: "pan.verify_attempted",
  PanVerifySucceeded: "pan.verify_succeeded",
  PanVerifyFailed: "pan.verify_failed",

  OtpSent: "otp.sent",
  OtpVerified: "otp.verified",
  OtpFailed: "otp.failed",

  BootstrapAttempted: "admin.bootstrap_attempted",
  BootstrapSucceeded: "admin.bootstrap_succeeded",
  BootstrapRejected: "admin.bootstrap_rejected",

  RateLimited: "security.rate_limited",
  AccessDenied: "security.access_denied",

  MembershipTierCreated: "membership.tier_created",
  MembershipTierUpdated: "membership.tier_updated",
  MembershipTierDeleted: "membership.tier_deleted",
  MembershipSettingsUpdated: "membership.settings_updated",
  MembershipOrderCreated: "membership.order_created",
  MembershipPaymentCaptured: "membership.payment_captured",
  MembershipExpired: "membership.expired",
  MembershipCancelled: "membership.cancelled",
  MembershipCancelAtPeriodEnd: "membership.cancel_at_period_end",
  MembershipOfferCreated: "membership.offer_created",
  MembershipOfferUpdated: "membership.offer_updated",
  MembershipOfferDeleted: "membership.offer_deleted",
  MembershipCardIssued: "membership.card_issued",
  RazorpayWebhookRejected: "membership.webhook_rejected",

  ContactMessageReceived: "contact.message_received",
  ContactMessageReviewed: "contact.message_reviewed",
  ContactMessageReplied: "contact.message_replied",
  ContactMessageArchived: "contact.message_archived",
  ContactMessageReopened: "contact.message_reopened",

  SupportBannerUpdated: "support.banner_updated",
  FieldProjectSaved: "project.saved",
  DonationSettingsUpdated: "donation.settings_updated",
  DonationMissionSaved: "donation.mission_saved",
  DonationCaptured: "donation.captured",
  DonationRefunded: "donation.refunded",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];
