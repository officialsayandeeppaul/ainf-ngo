import type { ContactMessageStatus, Prisma, Role } from "@prisma/client";
import { isMobileAccountEmail } from "./account-contact";
import { AuditAction, recordAudit } from "./audit";
import { db } from "./db";
import type { RequestContext } from "./request-context";
import { e164India, indianMobile } from "./mobile-auth";

/**
 * A member's inbox: what they wrote to AINF through the contact form (with the
 * team's reply, emailed or saved on the thread only) and messages the team sent
 * straight to their dashboard. Suspended members see it on the suspended page.
 *
 * Contact messages are matched by the account's email, the same way gifts are
 * (lib/user-donations): a signed-in member's message is always saved under that
 * email. Mobile sign-ups have no real email, so theirs are matched by mobile.
 */

export type InboxItem =
  | {
      kind: "thread";
      id: string;
      at: Date;
      body: string;
      status: ContactMessageStatus;
      reply: { body: string; at: Date } | null;
    }
  | {
      kind: "notice";
      id: string;
      at: Date;
      body: string;
      unread: boolean;
    };

type ThreadRow = {
  id: string;
  body: string;
  status: ContactMessageStatus;
  createdAt: Date;
  replyBody: string | null;
  repliedAt: Date | null;
};

type NoticeRow = { id: string; body: string; createdAt: Date; readAt: Date | null };

const INBOX_TAKE = 40;

/** Which contact messages belong to this account, or null when nothing can be matched. */
export function contactMessagesWhere(user: {
  email: string;
  phone: string | null;
}): Prisma.ContactMessageWhereInput | null {
  if (!isMobileAccountEmail(user.email)) return { email: user.email.trim().toLowerCase() };
  const mobile = user.phone ? indianMobile(user.phone) : null;
  return mobile ? { phone: e164India(mobile) } : null;
}

/** Threads and notices, newest activity first. Pure, so it is unit-tested. */
export function mergeInbox(threads: ThreadRow[], notices: NoticeRow[]): InboxItem[] {
  const items: InboxItem[] = [
    ...threads.map(
      (row): InboxItem => ({
        kind: "thread",
        id: row.id,
        at: row.createdAt,
        body: row.body,
        status: row.status,
        reply: row.replyBody && row.repliedAt ? { body: row.replyBody, at: row.repliedAt } : null,
      })
    ),
    ...notices.map(
      (row): InboxItem => ({
        kind: "notice",
        id: row.id,
        at: row.createdAt,
        body: row.body,
        unread: !row.readAt,
      })
    ),
  ];
  const latest = (item: InboxItem) => (item.kind === "thread" && item.reply ? item.reply.at : item.at).getTime();
  return items.sort((a, b) => latest(b) - latest(a));
}

export async function loadMemberInbox(user: {
  id: string;
  email: string;
  phone: string | null;
}): Promise<{ items: InboxItem[]; unread: number }> {
  const where = contactMessagesWhere(user);
  const [threads, notices] = await Promise.all([
    where
      ? db.contactMessage.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: INBOX_TAKE,
          select: { id: true, body: true, status: true, createdAt: true, replyBody: true, repliedAt: true },
        })
      : Promise.resolve([]),
    db.memberMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: INBOX_TAKE,
      select: { id: true, body: true, createdAt: true, readAt: true },
    }),
  ]);
  const items = mergeInbox(threads, notices);
  return { items, unread: items.filter((item) => item.kind === "notice" && item.unread).length };
}

/** New messages from AINF, for the dashboard's "You have a message" line. */
export async function unreadMemberMessages(userId: string): Promise<number> {
  return db.memberMessage.count({ where: { userId, readAt: null } });
}

export async function markMemberMessagesRead(userId: string): Promise<void> {
  await db.memberMessage.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/**
 * The contact details a signed-in member's message is saved under, so it shows
 * in their inbox: their account email, or for mobile sign-ups their mobile.
 */
export function accountContactFor(
  user: { email: string; phone: string | null },
  typed: { email: string; phone: string | null }
): { email: string; phone: string | null } {
  if (!isMobileAccountEmail(user.email)) return { email: user.email.trim().toLowerCase(), phone: typed.phone };
  const mobile = user.phone ? indianMobile(user.phone) : null;
  return { email: typed.email, phone: mobile ? e164India(mobile) : typed.phone };
}

export const MEMBER_MESSAGE_MAX = 4000;

/** A super admin writes to one member's dashboard inbox (works while they are suspended too). */
export async function sendMemberMessage(input: {
  userId: string;
  body: string;
  actor: { userId: string; clerkId: string; role: Role };
  context?: RequestContext | null;
}): Promise<{ ok: true; id: string; createdAt: Date } | { ok: false; status: number; message: string }> {
  const body = input.body.replace(/\r\n?/g, "\n").trim();
  if (body.length < 2) return { ok: false, status: 400, message: "Write a message first." };
  if (body.length > MEMBER_MESSAGE_MAX) {
    return { ok: false, status: 400, message: `Keep it under ${MEMBER_MESSAGE_MAX} characters.` };
  }
  const member = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true } });
  if (!member) return { ok: false, status: 404, message: "Member not found." };

  const row = await db.memberMessage.create({
    data: { userId: member.id, body, sentByUserId: input.actor.userId },
  });
  await recordAudit({
    action: AuditAction.MemberMessageSent,
    actorUserId: input.actor.userId,
    actorClerkId: input.actor.clerkId,
    actorRole: input.actor.role,
    targetType: "user",
    targetId: member.id,
    context: input.context ?? null,
    metadata: { status: member.status, length: body.length },
  });
  return { ok: true, id: row.id, createdAt: row.createdAt };
}
