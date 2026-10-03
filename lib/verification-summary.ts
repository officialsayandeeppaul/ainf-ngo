import { KycStatus, PanStatus } from "@prisma/client";

export type MethodTone = "neutral" | "success" | "warning" | "danger" | "info";

export type MethodLine = {
  id: "didit" | "pan" | "otp";
  label: string;
  tone: MethodTone;
  headline: string;
  attempts: number;
  passed: number;
};

export type OtpCounts = {
  sent: number;
  verified: number;
  failed: number;
};

export type KycSummaryRow = {
  status: KycStatus;
  createdAt: Date;
};

export type PanSummaryRow = {
  status: PanStatus;
  panLast4: string;
  nameMatch: boolean | null;
  dobMatch: boolean | null;
  createdAt: Date;
};

export type UserVerificationSummary = {
  kycStatus: KycStatus;
  totalAttempts: number;
  methodsPassed: number;
  methods: MethodLine[];
};

export function maskLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return `····${digits.slice(-4)}`;
}

export function emptyOtp(): OtpCounts {
  return { sent: 0, verified: 0, failed: 0 };
}

export function otpCountsFromActions(
  actions: Array<{ action: string; count: number }>
): OtpCounts {
  const counts = emptyOtp();
  for (const row of actions) {
    if (row.action === "otp.sent") counts.sent += row.count;
    if (row.action === "otp.verified") counts.verified += row.count;
    if (row.action === "otp.failed") counts.failed += row.count;
  }
  return counts;
}

export function summariseUserVerification(input: {
  kycStatus: KycStatus;
  phone?: string | null;
  kyc: KycSummaryRow[];
  pan: PanSummaryRow[];
  otp: OtpCounts;
}): UserVerificationSummary {
  const methods = [diditLine(input.kyc), panLine(input.pan), otpLine(input.otp, input.phone)];
  return {
    kycStatus: input.kycStatus,
    totalAttempts: methods.reduce((sum, method) => sum + method.attempts, 0),
    methodsPassed: methods.filter((method) => method.passed > 0).length,
    methods,
  };
}

function diditLine(kyc: KycSummaryRow[]): MethodLine {
  const attempts = kyc.length;
  const passed = kyc.filter((row) => row.status === KycStatus.APPROVED).length;
  const latest = kyc[0];
  if (!latest) {
    return { id: "didit", label: "Didit", tone: "neutral", headline: "Not started", attempts, passed };
  }

  const sessions = `${attempts} session${attempts === 1 ? "" : "s"}`;
  if (latest.status === KycStatus.APPROVED) {
    return {
      id: "didit",
      label: "Didit",
      tone: "success",
      headline: passed > 1 ? `Approved · ${sessions}` : "Approved",
      attempts,
      passed,
    };
  }
  if (latest.status === KycStatus.IN_REVIEW) {
    return { id: "didit", label: "Didit", tone: "warning", headline: `In review · ${sessions}`, attempts, passed };
  }
  if (latest.status === KycStatus.IN_PROGRESS) {
    return { id: "didit", label: "Didit", tone: "info", headline: `In progress · ${sessions}`, attempts, passed };
  }
  if (latest.status === KycStatus.DECLINED) {
    return { id: "didit", label: "Didit", tone: "danger", headline: `Declined · ${sessions}`, attempts, passed };
  }
  return {
    id: "didit",
    label: "Didit",
    tone: "neutral",
    headline: `${prettyKyc(latest.status)} · ${sessions}`,
    attempts,
    passed,
  };
}

function panLine(pan: PanSummaryRow[]): MethodLine {
  const attempts = pan.length;
  const passed = pan.filter((row) => row.status === PanStatus.VERIFIED).length;
  const latest = pan[0];
  if (!latest) {
    return { id: "pan", label: "APITXT PAN", tone: "neutral", headline: "Not started", attempts, passed };
  }

  const tail = latest.panLast4 ? ` · ····${latest.panLast4}` : "";
  if (latest.status === PanStatus.VERIFIED) {
    return {
      id: "pan",
      label: "APITXT PAN",
      tone: "success",
      headline: `Verified${tail}`,
      attempts,
      passed,
    };
  }
  if (latest.status === PanStatus.MISMATCH) {
    return {
      id: "pan",
      label: "APITXT PAN",
      tone: "warning",
      headline: `Name/DOB mismatch${tail}`,
      attempts,
      passed,
    };
  }
  if (latest.status === PanStatus.FAILED) {
    return {
      id: "pan",
      label: "APITXT PAN",
      tone: "danger",
      headline: attempts > 1 ? `Failed · ${attempts} tries` : `Failed${tail}`,
      attempts,
      passed,
    };
  }
  return {
    id: "pan",
    label: "APITXT PAN",
    tone: "info",
    headline: `Pending${tail}`,
    attempts,
    passed,
  };
}

function otpLine(otp: OtpCounts, phone?: string | null): MethodLine {
  const attempts = otp.sent + otp.verified + otp.failed;
  const passed = otp.verified;
  const masked = maskLast4(phone);
  if (otp.verified > 0) {
    return {
      id: "otp",
      label: "Mobile OTP",
      tone: "success",
      headline: masked ? `Verified · ${masked}` : "Verified",
      attempts,
      passed,
    };
  }
  if (otp.failed > 0 && otp.sent === 0) {
    return { id: "otp", label: "Mobile OTP", tone: "danger", headline: "Failed", attempts, passed };
  }
  if (otp.sent > 0) {
    return {
      id: "otp",
      label: "Mobile OTP",
      tone: "info",
      headline: `${otp.sent} code${otp.sent === 1 ? "" : "s"} sent`,
      attempts,
      passed,
    };
  }
  return { id: "otp", label: "Mobile OTP", tone: "neutral", headline: "Not started", attempts, passed };
}

function prettyKyc(status: KycStatus): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
