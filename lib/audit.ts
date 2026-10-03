import type { Prisma, Role } from "@prisma/client";
import { db } from "./db";
import { isDatabaseConfigured } from "./env";
import type { RequestContext } from "./request-context";
import { AuditAction, type AuditActionValue } from "./audit-actions";

export { AuditAction, type AuditActionValue };

/**
 * Append-only audit trail. Nothing in the application updates or deletes rows.
 *
 * Writes never throw into the caller: losing an audit row must not roll back or
 * break a user-facing action, but it must always surface in server logs.
 */

export type AuditEntry = {
  action: AuditActionValue | string;
  actorUserId?: string | null;
  actorClerkId?: string | null;
  actorRole?: Role | null;
  targetType?: string | null;
  targetId?: string | null;
  success?: boolean;
  context?: RequestContext | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  if (!isDatabaseConfigured) {
    console.warn(`[audit] ${entry.action} (not persisted: database unconfigured)`);
    return;
  }
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorClerkId: entry.actorClerkId ?? null,
        actorRole: entry.actorRole ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        success: entry.success ?? true,
        ip: entry.context?.ip ?? null,
        userAgent: entry.context?.userAgent ?? null,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error(`[audit] failed to persist ${entry.action}`, error);
  }
}
