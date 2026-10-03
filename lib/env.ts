import { z } from "zod";

/**
 * Server environment access.
 *
 * Integrations are validated lazily rather than at import time: the 25 Framer
 * HTML routes must keep serving even when the portal's third-party keys are
 * absent, and a boot-time throw would take the whole site down. Each feature
 * asks for its own config through `require*Env()` and gets a precise error.
 */

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),

  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  DIDIT_API_KEY: z.string().optional(),
  DIDIT_WORKFLOW_ID: z.string().optional(),
  DIDIT_WEBHOOK_SECRET: z.string().optional(),
  DIDIT_API_BASE: z.string().url().default("https://verification.didit.me"),

  APITXT_AUTH_KEY: z.string().optional(),
  APITXT_BASE_URL: z.string().url().default("https://apitxt.com"),
  APITXT_SENDER_ID: z.string().optional(),
  APITXT_ROUTE: z.string().default("4"),
  APITXT_DLT_TEMPLATE_ID: z.string().optional(),
  APITXT_PE_ID: z.string().optional(),
  /** Second APITXT key, used only for text OTP (sendOTP). No DLT fields. */
  APITXT_OTP_AUTH_KEY: z.string().optional(),
  /** When "true", SMS includes DLT_TE_ID / PE_ID. Default is off. */
  APITXT_REQUIRE_DLT: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("AINF <onboarding@resend.dev>"),
  RESEND_SANDBOX_TO_EMAIL: z.string().optional(),
  SECURITY_ALERT_EMAIL: z.string().optional(),

  SUPER_ADMIN_BOOTSTRAP_KEY: z.string().optional(),
  SUPER_ADMIN_ALLOW_MULTIPLE: bool,
  /** Unset = required in production only. Clerk MFA is a paid plan. */
  SUPER_ADMIN_REQUIRE_MFA: z.string().optional(),

  PAN_HASH_SALT: z.string().optional(),

  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // Feature toggles. Unset = auto (on when the related keys exist).
  VERIFICATION_DIDIT: z.string().optional(),
  VERIFICATION_PAN: z.string().optional(),
  VERIFICATION_OTP: z.string().optional(),
});

/** Treats "" the same as unset so a placeholder line never reads as configured. */
function normalize(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

const parsed = rawSchema.safeParse(normalize(process.env));

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";

export class MissingConfigError extends Error {
  readonly keys: string[];
  constructor(feature: string, keys: string[]) {
    super(
      `${feature} is not configured. Set ${keys.join(", ")} in .env.local. ` +
        `See .env.example for guidance.`
    );
    this.name = "MissingConfigError";
    this.keys = keys;
  }
}

function requireKeys<K extends keyof typeof env>(feature: string, keys: K[]) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) throw new MissingConfigError(feature, missing as string[]);
  return keys.reduce((acc, k) => {
    acc[k] = env[k] as NonNullable<(typeof env)[K]>;
    return acc;
  }, {} as { [P in K]: NonNullable<(typeof env)[P]> });
}

export const isClerkConfigured = Boolean(
  env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY
);
export const isDatabaseConfigured = Boolean(env.DATABASE_URL);
export const isRedisConfigured = Boolean(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
);
export const isDiditConfigured = Boolean(env.DIDIT_API_KEY && env.DIDIT_WORKFLOW_ID);
export const isDiditWebhookConfigured = Boolean(env.DIDIT_WEBHOOK_SECRET);
export const isApitxtConfigured = Boolean(env.APITXT_AUTH_KEY);
export const isResendConfigured = Boolean(env.RESEND_API_KEY);

/** True when FROM is still Resend's shared test domain (cannot mail arbitrary recipients). */
export const isResendSandbox = /@resend\.dev\b/i.test(env.RESEND_FROM_EMAIL);

export const resendSandboxToEmail = (env.RESEND_SANDBOX_TO_EMAIL || "").trim().toLowerCase() || null;

export const isClerkWebhookConfigured = Boolean(env.CLERK_WEBHOOK_SIGNING_SECRET);
export const isDltRequired = env.APITXT_REQUIRE_DLT === "true" || env.APITXT_REQUIRE_DLT === "1";
export const isSmsConfigured = Boolean(env.APITXT_AUTH_KEY && env.APITXT_SENDER_ID);
export const isTextOtpConfigured = Boolean(env.APITXT_OTP_AUTH_KEY);
export const isBootstrapConfigured = Boolean(env.SUPER_ADMIN_BOOTSTRAP_KEY && env.PAN_HASH_SALT);
export const isRazorpayConfigured = Boolean(
  env.NEXT_PUBLIC_RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
);
export const isRazorpayWebhookConfigured = Boolean(env.RAZORPAY_WEBHOOK_SECRET);
export const isAdminMfaRequired = (() => {
  const raw = env.SUPER_ADMIN_REQUIRE_MFA;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return isProduction;
})();

export const requireDatabaseEnv = () => requireKeys("Database (Neon Postgres)", ["DATABASE_URL"]);
export const requireRedisEnv = () =>
  requireKeys("Rate limiting (Upstash Redis)", [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]);
export const requireDiditEnv = () =>
  requireKeys("Didit verification", ["DIDIT_API_KEY", "DIDIT_WORKFLOW_ID"]);
export const requireDiditWebhookEnv = () =>
  requireKeys("Didit webhook verification", ["DIDIT_WEBHOOK_SECRET"]);
export const requireApitxtEnv = () => requireKeys("APITXT", ["APITXT_AUTH_KEY"]);
export const requireResendEnv = () => requireKeys("Resend email", ["RESEND_API_KEY"]);
export const requireBootstrapEnv = () =>
  requireKeys("Super admin bootstrap", ["SUPER_ADMIN_BOOTSTRAP_KEY"]);
export const requirePanSaltEnv = () => requireKeys("PAN hashing", ["PAN_HASH_SALT"]);
export const requireClerkWebhookEnv = () =>
  requireKeys("Clerk webhook", ["CLERK_WEBHOOK_SIGNING_SECRET"]);
export const requireRazorpayEnv = () =>
  requireKeys("Razorpay", ["NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
export const requireRazorpayWebhookEnv = () =>
  requireKeys("Razorpay webhook", ["RAZORPAY_WEBHOOK_SECRET"]);

/** Absolute URL builder used for Didit callbacks and email links. */
export function absoluteUrl(path: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
