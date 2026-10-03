import {
  env,
  isAdminMfaRequired,
  isApitxtConfigured,
  isBootstrapConfigured,
  isClerkConfigured,
  isClerkWebhookConfigured,
  isDatabaseConfigured,
  isDiditConfigured,
  isDiditWebhookConfigured,
  isDltRequired,
  isRedisConfigured,
  isResendConfigured,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
  isSmsConfigured,
} from "./env";
import { getVerificationPolicy } from "./verification-policy";

export type ServiceRow = {
  id: string;
  name: string;
  group: "auth" | "data" | "verification" | "messaging" | "security" | "payments";
  on: boolean;
  detail: string;
};

export function listServices(): ServiceRow[] {
  const policy = getVerificationPolicy();
  return [
    {
      id: "clerk",
      name: "Clerk",
      group: "auth",
      on: isClerkConfigured,
      detail: "Sign-in, sessions, and TOTP MFA in the account menu.",
    },
    {
      id: "clerk-mfa",
      name: "Clerk MFA",
      group: "auth",
      on: isClerkConfigured,
      detail: isClerkConfigured
        ? isAdminMfaRequired
          ? "TOTP is required for super admin bootstrap. Members manage it from the avatar menu (Clerk Pro)."
          : "Clerk TOTP exists on paid plans. This instance allows bootstrap without MFA (SUPER_ADMIN_REQUIRE_MFA=false)."
        : "Clerk keys missing — MFA cannot enrol.",
    },
    {
      id: "clerk-webhook",
      name: "Clerk webhooks",
      group: "auth",
      on: isClerkWebhookConfigured,
      detail: "Keeps User rows in sync. Set CLERK_WEBHOOK_SIGNING_SECRET.",
    },
    {
      id: "postgres",
      name: "Neon Postgres",
      group: "data",
      on: isDatabaseConfigured,
      detail: "Authoritative roles, KYC, PAN hashes, and the audit log.",
    },
    {
      id: "redis",
      name: "Upstash Redis",
      group: "data",
      on: isRedisConfigured,
      detail: "Sliding-window rate limits. Production fails closed without it.",
    },
    {
      id: "didit",
      name: "Didit identity",
      group: "verification",
      on: policy.didit,
      detail: policy.didit
        ? "ID + selfie. VERIFICATION_DIDIT=true|false."
        : "Off. Set DIDIT keys or VERIFICATION_DIDIT=true.",
    },
    {
      id: "didit-webhook",
      name: "Didit webhooks",
      group: "verification",
      on: isDiditWebhookConfigured,
      detail: isDiditWebhookConfigured
        ? "Signed decisions apply automatically."
        : "Unset DIDIT_WEBHOOK_SECRET — localhost uses the return-URL API fetch instead.",
    },
    {
      id: "pan",
      name: "APITXT PAN",
      group: "verification",
      on: policy.pan,
      detail: policy.pan
        ? "Unlocks after Didit approval when both are on. VERIFICATION_PAN=true|false."
        : "Off. Set APITXT_AUTH_KEY or VERIFICATION_PAN=true.",
    },
    {
      id: "otp",
      name: "Mobile OTP",
      group: "verification",
      on: policy.otp,
      detail: policy.otp
        ? `On via ${policy.otpChannel}. Auto-on when Didit and PAN are both off.`
        : "Off. Set VERIFICATION_OTP=true, or turn Didit and PAN off.",
    },
    {
      id: "sms",
      name: "APITXT SMS",
      group: "messaging",
      on: isSmsConfigured,
      detail: isSmsConfigured
        ? isDltRequired
          ? "SMS with DLT fields (APITXT_REQUIRE_DLT=true)."
          : "SMS without DLT. Sender id is set; DLT template ids are ignored."
        : "Needs APITXT_AUTH_KEY and APITXT_SENDER_ID. OTP can still use email.",
    },
    {
      id: "dlt",
      name: "India DLT",
      group: "messaging",
      on: isDltRequired,
      detail: isDltRequired
        ? "Required. SMS includes DLT_TE_ID and PE_ID when present."
        : "Not required. Verification works without DLT templates.",
    },
    {
      id: "resend",
      name: "Resend email",
      group: "messaging",
      on: isResendConfigured,
      detail: "Outcomes, OTP fallback, and admin alerts.",
    },
    {
      id: "razorpay",
      name: "Razorpay",
      group: "payments",
      on: isRazorpayConfigured,
      detail: isRazorpayConfigured
        ? "Test keys present. Members pay from /account/membership."
        : "Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    },
    {
      id: "razorpay-webhook",
      name: "Razorpay webhooks",
      group: "payments",
      on: isRazorpayWebhookConfigured,
      detail: isRazorpayWebhookConfigured
        ? "Signed payment.captured events mark orders paid."
        : "Add /api/webhooks/razorpay in the Razorpay dashboard, then set RAZORPAY_WEBHOOK_SECRET.",
    },
    {
      id: "bootstrap",
      name: "Super admin bootstrap",
      group: "security",
      on: isBootstrapConfigured,
      detail: "Key-gated promotion. MFA must already be enrolled.",
    },
    {
      id: "didit-keys",
      name: "Didit API keys",
      group: "verification",
      on: isDiditConfigured,
      detail: isDiditConfigured ? "API key and workflow are present." : "DIDIT_API_KEY or workflow missing.",
    },
    {
      id: "app-url",
      name: "Public origin",
      group: "security",
      on: Boolean(env.NEXT_PUBLIC_APP_URL),
      detail: env.NEXT_PUBLIC_APP_URL,
    },
  ];
}

export function servicesByGroup(rows = listServices()) {
  const groups: Record<ServiceRow["group"], ServiceRow[]> = {
    auth: [],
    data: [],
    verification: [],
    messaging: [],
    security: [],
    payments: [],
  };
  for (const row of rows) groups[row.group].push(row);
  return groups;
}
