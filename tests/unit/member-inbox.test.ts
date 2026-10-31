import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: null as { id: string; status: string } | null,
  created: [] as Array<Record<string, unknown>>,
  threads: [] as Array<Record<string, unknown>>,
  notices: [] as Array<Record<string, unknown>>,
  threadWhere: null as unknown,
  audit: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(async () => (h.user ? { ...h.user } : null)) },
    memberMessage: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        h.created.push(data);
        return { id: "msg_1", createdAt: new Date("2026-11-01T10:00:00Z"), ...data };
      }),
      findMany: vi.fn(async () => h.notices),
    },
    contactMessage: {
      findMany: vi.fn(async ({ where }: { where: unknown }) => {
        h.threadWhere = where;
        return h.threads;
      }),
    },
  },
}));
vi.mock("@/lib/audit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-actions")>("@/lib/audit-actions");
  return { AuditAction: actual.AuditAction, recordAudit: h.audit };
});

import {
  accountContactFor,
  contactMessagesWhere,
  loadMemberInbox,
  mergeInbox,
  sendMemberMessage,
} from "@/lib/member-inbox";

const actor = { userId: "admin_1", clerkId: "clerk_admin", role: "SUPER_ADMIN" as const };

beforeEach(() => {
  h.user = { id: "user_1", status: "SUSPENDED" };
  h.created = [];
  h.threads = [];
  h.notices = [];
  h.threadWhere = null;
  h.audit.mockClear();
});

describe("which contact messages are a member's", () => {
  it("matches email accounts by their email, lowercased", () => {
    expect(contactMessagesWhere({ email: " Mina@Example.com ", phone: null })).toEqual({ email: "mina@example.com" });
  });

  it("matches mobile sign-ups by mobile, in the form the contact form stores", () => {
    expect(contactMessagesWhere({ email: "9876543210@mobile.theainf.in", phone: "+919876543210" })).toEqual({
      phone: "+919876543210",
    });
    expect(contactMessagesWhere({ email: "9876543210@mobile.theainf.in", phone: null })).toBeNull();
  });

  it("files a signed-in member's message under their account", () => {
    expect(accountContactFor({ email: "mina@example.com", phone: null }, { email: "typed@x.com", phone: null })).toEqual({
      email: "mina@example.com",
      phone: null,
    });
    expect(
      accountContactFor(
        { email: "9876543210@mobile.theainf.in", phone: "+91 98765 43210" },
        { email: "mina@gmail.com", phone: null }
      )
    ).toEqual({ email: "mina@gmail.com", phone: "+919876543210" });
  });
});

describe("mergeInbox", () => {
  it("orders by latest activity, so a fresh reply comes first", () => {
    const items = mergeInbox(
      [
        {
          id: "t1",
          body: "Old question",
          status: "REPLIED",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          replyBody: "Answer",
          repliedAt: new Date("2026-10-30T00:00:00Z"),
        },
        {
          id: "t2",
          body: "Waiting one",
          status: "NEW",
          createdAt: new Date("2026-10-20T00:00:00Z"),
          replyBody: null,
          repliedAt: null,
        },
      ],
      [{ id: "n1", body: "From the team", createdAt: new Date("2026-10-25T00:00:00Z"), readAt: null }]
    );
    expect(items.map((item) => item.id)).toEqual(["t1", "n1", "t2"]);
    expect(items[0]).toMatchObject({ kind: "thread", reply: { body: "Answer" } });
    expect(items[1]).toMatchObject({ kind: "notice", unread: true });
    expect(items[2]).toMatchObject({ kind: "thread", reply: null });
  });
});

describe("loadMemberInbox", () => {
  it("counts unread team messages", async () => {
    h.notices = [
      { id: "n1", body: "a", createdAt: new Date(), readAt: null },
      { id: "n2", body: "b", createdAt: new Date(), readAt: new Date() },
    ];
    const inbox = await loadMemberInbox({ id: "user_1", email: "mina@example.com", phone: null });
    expect(inbox.unread).toBe(1);
    expect(h.threadWhere).toEqual({ email: "mina@example.com" });
  });
});

describe("sendMemberMessage", () => {
  it("saves the message for the member, suspended or not, and audits it", async () => {
    const result = await sendMemberMessage({ userId: "user_1", body: "  Hello Mina,\r\nplease call us.  ", actor });
    expect(result.ok).toBe(true);
    expect(h.created).toEqual([{ userId: "user_1", body: "Hello Mina,\nplease call us.", sentByUserId: "admin_1" }]);
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.message_sent", targetId: "user_1", metadata: { status: "SUSPENDED", length: 27 } })
    );
  });

  it("refuses empty or unknown", async () => {
    expect(await sendMemberMessage({ userId: "user_1", body: "  ", actor })).toMatchObject({ ok: false, status: 400 });
    h.user = null;
    expect(await sendMemberMessage({ userId: "nobody", body: "Hello", actor })).toMatchObject({ ok: false, status: 404 });
    expect(h.created).toEqual([]);
  });
});
