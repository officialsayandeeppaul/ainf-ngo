import { beforeEach, describe, expect, it, vi } from "vitest";
import { KycStatus } from "@prisma/client";

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  kyc: [] as Array<{ status: string }>,
  pan: [] as Array<{ status: string }>,
  otpCount: 0,
  updates: [] as Array<Record<string, unknown>>,
  changeRole: vi.fn(async (args: { nextRole: string }) => ({ role: args.nextRole })),
  revokeVerified: vi.fn(async () => ({ role: "USER" })),
  email: vi.fn(async () => ({ sent: true })),
  audit: vi.fn(async () => {}),
  policy: { didit: true, pan: true, otp: false, otpChannel: "none" as const },
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => (h.user ? { ...h.user } : null)),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.updates.push(data);
        h.user = { ...h.user, ...data };
        return { ...h.user };
      }),
    },
    kycVerification: { findMany: vi.fn(async () => h.kyc) },
    panVerification: { findMany: vi.fn(async () => h.pan) },
    auditLog: { count: vi.fn(async () => h.otpCount) },
  },
}));

vi.mock("@/lib/auth/role-service", () => ({ changeRole: h.changeRole, revokeVerified: h.revokeVerified }));
vi.mock("@/lib/email", () => ({ sendKycApprovedEmail: h.email }));
vi.mock("@/lib/verification-policy", () => ({ getVerificationPolicy: () => h.policy }));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

import { identityFromOwnRecords, removeIdentityOverride, verifyIdentityByAdmin } from "@/lib/identity-override";

const actor = { userId: "admin_1", clerkId: "clerk_admin", role: "SUPER_ADMIN" as const };

beforeEach(() => {
  h.user = {
    id: "user_1",
    email: "mina@example.com",
    firstName: "Mina",
    role: "USER",
    kycStatus: "NOT_STARTED",
    panVerified: false,
    identityVerifiedByAdminAt: null,
  };
  h.kyc = [];
  h.pan = [];
  h.otpCount = 0;
  h.updates = [];
  h.policy = { didit: true, pan: true, otp: false, otpChannel: "none" };
  [h.changeRole, h.revokeVerified, h.email, h.audit].forEach((fn) => fn.mockClear());
});

describe("own records", () => {
  it("keeps an approved Didit session or a verified mobile code", () => {
    expect(identityFromOwnRecords({ kyc: [{ status: KycStatus.APPROVED }], pan: [], otpVerified: false }, { didit: true }))
      .toEqual({ kycStatus: KycStatus.APPROVED, panVerified: false });
    expect(identityFromOwnRecords({ kyc: [], pan: [], otpVerified: true }, { didit: true }).kycStatus).toBe(KycStatus.APPROVED);
  });

  it("counts a verified PAN as identity only when Didit is off", () => {
    const records = { kyc: [], pan: [{ status: "VERIFIED" }], otpVerified: false };
    expect(identityFromOwnRecords(records, { didit: false })).toEqual({ kycStatus: KycStatus.APPROVED, panVerified: true });
    expect(identityFromOwnRecords(records, { didit: true })).toEqual({ kycStatus: KycStatus.NOT_STARTED, panVerified: true });
  });

  it("falls back to the latest session status, or not started", () => {
    expect(identityFromOwnRecords({ kyc: [{ status: KycStatus.DECLINED }], pan: [], otpVerified: false }, { didit: true }).kycStatus).toBe(
      KycStatus.DECLINED
    );
    expect(identityFromOwnRecords({ kyc: [], pan: [], otpVerified: false }, { didit: true }).kycStatus).toBe(KycStatus.NOT_STARTED);
  });
});

describe("admin verification", () => {
  it("opens every identity gate, promotes a member, and records who did it", async () => {
    const result = await verifyIdentityByAdmin({ userId: "user_1", note: "Checked in person", notify: true, actor });
    expect(result).toMatchObject({ ok: true, user: { role: "VERIFIED_USER" } });
    expect(h.updates[0]).toMatchObject({
      kycStatus: "APPROVED",
      panVerified: true,
      identityVerifiedByUserId: "admin_1",
      identityVerifiedNote: "Checked in person",
    });
    expect(h.changeRole).toHaveBeenCalledWith(
      expect.objectContaining({ nextRole: "VERIFIED_USER", reason: "admin_identity" })
    );
    expect(h.email).toHaveBeenCalledTimes(1);
  });

  it("never changes a super admin's role", async () => {
    h.user = { ...h.user!, role: "SUPER_ADMIN" };
    await verifyIdentityByAdmin({ userId: "user_1", notify: false, actor });
    expect(h.changeRole).not.toHaveBeenCalled();
  });

  it("removing it demotes a member with no checks of their own", async () => {
    await verifyIdentityByAdmin({ userId: "user_1", notify: false, actor });
    h.user = { ...h.user!, role: "VERIFIED_USER" };
    const result = await removeIdentityOverride({ userId: "user_1", actor });
    expect(result).toMatchObject({ ok: true, stillVerified: false });
    expect(h.updates.at(-1)).toMatchObject({
      kycStatus: "NOT_STARTED",
      panVerified: false,
      identityVerifiedByAdminAt: null,
    });
    expect(h.revokeVerified).toHaveBeenCalledTimes(1);
  });

  it("removing it keeps a member who passed Didit and PAN themselves", async () => {
    h.kyc = [{ status: "APPROVED" }];
    h.pan = [{ status: "VERIFIED" }];
    await verifyIdentityByAdmin({ userId: "user_1", notify: false, actor });
    h.user = { ...h.user!, role: "VERIFIED_USER" };
    const result = await removeIdentityOverride({ userId: "user_1", actor });
    expect(result).toMatchObject({ ok: true, stillVerified: true });
    expect(h.revokeVerified).not.toHaveBeenCalled();
  });

  it("refuses to remove a verification an admin never gave", async () => {
    expect(await removeIdentityOverride({ userId: "user_1", actor })).toMatchObject({ ok: false, status: 409 });
  });
});
