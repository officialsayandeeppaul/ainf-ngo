/**
 * Unit-test environment.
 *
 * lib/env.ts validates process.env at import time, so these must be set before
 * any module under test is loaded. Values are deliberately fake: no unit test
 * is allowed to reach a real Didit, APITXT, Resend, Neon, or Upstash endpoint.
 */

// @types/node declares NODE_ENV as readonly, so assign through the record.
Object.assign(process.env, { NODE_ENV: "test" });
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

process.env.DIDIT_API_KEY = "test_didit_key";
process.env.DIDIT_WORKFLOW_ID = "00000000-0000-0000-0000-000000000000";
process.env.DIDIT_WEBHOOK_SECRET = "test_didit_webhook_secret";

process.env.APITXT_AUTH_KEY = "test_apitxt_key";
process.env.APITXT_OTP_AUTH_KEY = "test_otp_key";
process.env.APITXT_SENDER_ID = "AINFTX";
process.env.APITXT_DLT_TEMPLATE_ID = "should-not-be-sent";
process.env.APITXT_REQUIRE_DLT = "false";
process.env.PAN_HASH_SALT = "test_pan_salt";
process.env.SUPER_ADMIN_BOOTSTRAP_KEY = "test_bootstrap_key_value";
process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "test_razorpay_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_razorpay_webhook_secret";

// Intentionally absent so the rate limiter exercises its in-memory fallback.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
