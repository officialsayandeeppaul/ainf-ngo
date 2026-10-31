/**
 * Plain-English wording for the codes the database and the audit log store
 * (NOT_STARTED, VERIFIED_USER, admin_identity, …), so admins never read a raw
 * code. No server imports: client components use this too.
 */

const WORDS: Record<string, string> = {
  // Roles and account status
  USER: "Member",
  VERIFIED_USER: "Verified member",
  SUPER_ADMIN: "Super admin",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
  // Identity (Didit) and PAN
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  DECLINED: "Declined",
  ABANDONED: "Abandoned",
  EXPIRED: "Expired",
  PENDING: "Pending",
  VERIFIED: "Verified",
  MISMATCH: "Name or date of birth did not match",
  FAILED: "Failed",
  // Money
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
  CREATED: "Started",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  REFUNDED: "Returned",
  NEW: "New",
  RENEWAL: "Renewal",
  UPGRADE: "Upgrade",
  DOWNGRADE: "Downgrade",
  INTERVAL_CHANGE: "Billing cycle change",
  NONE: "None",
  PERCENT: "Percent",
  FLAT: "Fixed amount",
  GENERAL: "General fund",
  MISSION: "Mission",
  PROJECT: "Project",
  DONATION: "Donation",
  MEMBERSHIP: "Membership",
  OPEN: "Waiting",
  CONTACTED: "Contacted",
  LINK_SENT: "Link sent",
  DISMISSED: "Dismissed",
  // Messages
  REVIEWED: "Reviewed",
  REPLIED: "Replied",
  ARCHIVED: "Archived",
  // Reasons and sources recorded with audit rows
  admin_identity: "Verified by an admin",
  admin_verification_removed: "Admin verification removed",
  kyc_approved: "Identity approved",
  kyc_revoked: "Identity approval withdrawn",
  otp_verified: "Mobile code confirmed",
  pan_verified: "PAN confirmed",
  bootstrap: "First admin set up",
  already_approved: "Already approved",
  pan_already_linked: "PAN already used on another account",
  rate_limited: "Too many attempts",
  self_mutation_blocked: "Admins cannot change their own account",
  mfa_not_enrolled: "Two-step sign-in not set up",
  super_admin_exists: "A super admin already exists",
  unauthenticated: "Not signed in",
  invalid_key: "Wrong admin key",
  session_user_mismatch: "Session belongs to another member",
  unknown_session: "Unknown verification session",
  unknown_order: "Unknown order",
  no_decision: "No decision yet",
  stale_or_missing_timestamp: "Expired or missing time stamp",
  webhook_secret_missing: "Webhook secret not set",
  no_signature_header: "Signature missing",
  invalid_signature: "Signature not valid",
  signature_verification_failed: "Signature check failed",
  signature_mismatch_raw: "Signature did not match",
  signature_mismatch_simple: "Signature did not match",
  invalid_json: "Unreadable request",
  invalid_checkout_signature: "Checkout signature not valid",
  invalid_donation_signature: "Donation signature not valid",
  not_active: "Not active",
  callback_api: "Return from Didit",
  webhook: "Didit notification",
  SIMPLE: "Re-checked with Didit",
  user: "Member",
  sms: "Text message",
  email: "Email",
};

const CODE = /^(?:[A-Z0-9]+(?:_[A-Z0-9]+)+|[a-z0-9]+(?:_[a-z0-9]+)+)$/;

/** "NOT_STARTED" → "Not started", "admin_identity" → "Verified by an admin"; other text unchanged. */
export function plainCode(raw: string): string {
  const known = WORDS[raw];
  if (known) return known;
  if (!CODE.test(raw)) return raw;
  const words = raw.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function kycLabel(status: string): string {
  return plainCode(status);
}
