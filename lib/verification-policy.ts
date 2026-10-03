import { isApitxtConfigured, isDiditConfigured, isResendConfigured, isSmsConfigured, env } from "./env";

/**
 * Which verification methods this instance actually offers.
 *
 * Keys being present is the default "on". Operators can force a method off
 * without deleting keys (VERIFICATION_DIDIT=false) or force the OTP fallback
 * on (VERIFICATION_OTP=true). When both Didit and PAN are off, OTP turns on
 * automatically so members still have a path to verified standing.
 */

function toggle(raw: string | undefined, fallback: boolean): boolean {
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return fallback;
}

export type VerificationPolicy = {
  didit: boolean;
  pan: boolean;
  otp: boolean;
  /** How OTP is delivered when that path is on. */
  otpChannel: "sms" | "email" | "none";
};

export type VerificationPolicyInput = {
  diditConfigured: boolean;
  panConfigured: boolean;
  diditFlag?: string;
  panFlag?: string;
  otpFlag?: string;
  hasSms: boolean;
  hasEmail: boolean;
};

export function resolveVerificationPolicy(input: VerificationPolicyInput): VerificationPolicy {
  const didit = toggle(input.diditFlag, input.diditConfigured);
  const pan = toggle(input.panFlag, input.panConfigured);
  const otp = toggle(input.otpFlag, !didit && !pan);

  let otpChannel: VerificationPolicy["otpChannel"] = "none";
  if (otp) {
    if (input.hasSms) otpChannel = "sms";
    else if (input.hasEmail) otpChannel = "email";
  }

  return { didit, pan, otp, otpChannel };
}

export function getVerificationPolicy(): VerificationPolicy {
  return resolveVerificationPolicy({
    diditConfigured: isDiditConfigured,
    panConfigured: isApitxtConfigured,
    diditFlag: env.VERIFICATION_DIDIT,
    panFlag: env.VERIFICATION_PAN,
    otpFlag: env.VERIFICATION_OTP,
    hasSms: isSmsConfigured,
    hasEmail: isResendConfigured,
  });
}

export function verificationMethodCount(policy = getVerificationPolicy()): number {
  return Number(policy.didit) + Number(policy.pan) + Number(policy.otp);
}
