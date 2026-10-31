import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 1 })),
  audit: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({ db: { user: { updateMany: h.updateMany } } }));
vi.mock("@/lib/auth/session", () => ({ mirrorRoleToClerk: vi.fn() }));
vi.mock("@/lib/suspension-notice", () => ({ sendSuspensionNotice: vi.fn() }));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

import type { User } from "@prisma/client";
import { recordSuspensionSeen } from "@/lib/auth/role-service";

const suspended = {
  id: "user_1",
  clerkId: "clerk_1",
  role: "USER",
  status: "SUSPENDED",
  suspensionNoticeChannel: null,
  suspensionNoticeSentAt: null,
} as unknown as User;

beforeEach(() => {
  h.updateMany.mockClear();
  h.updateMany.mockResolvedValue({ count: 1 });
  h.audit.mockClear();
});

describe("member sees the suspension at sign-in", () => {
  it("records it once, as seen on their dashboard, and audits it", async () => {
    expect(await recordSuspensionSeen({ user: suspended })).toBe(true);
    expect(h.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "user_1", suspensionNoticeSentAt: null }),
        data: expect.objectContaining({ suspensionNoticeChannel: "dashboard" }),
      })
    );
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.suspension_notice", metadata: expect.objectContaining({ channel: "dashboard" }) })
    );
  });

  it("keeps an earlier WhatsApp / email notice as it is", async () => {
    const told = { ...suspended, suspensionNoticeChannel: "whatsapp", suspensionNoticeSentAt: new Date() } as User;
    expect(await recordSuspensionSeen({ user: told })).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("does nothing for active accounts or when another tab already recorded it", async () => {
    expect(await recordSuspensionSeen({ user: { ...suspended, status: "ACTIVE" } as User })).toBe(false);
    expect(h.updateMany).not.toHaveBeenCalled();
    h.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await recordSuspensionSeen({ user: suspended })).toBe(false);
    expect(h.audit).not.toHaveBeenCalled();
  });
});
