import type { Prisma } from "@prisma/client";
import { auditActionLabel, auditChips } from "./audit-display";

export type JourneyKind = "account" | "identity" | "payment" | "membership" | "access" | "admin";

export type JourneyEvent = {
  at: string;
  title: string;
  detail: string;
  tone: "ok" | "warn" | "bad" | "info";
  kind: JourneyKind;
};

const SKIP_AUDIT = new Set([
  "user.created",
  "membership.order_created",
  "membership.payment_captured",
]);

function orderLine(
  order: {
    tierName: string;
    interval: string;
    amountLabel: string;
    recurring: boolean;
    offerName?: string | null;
    creditLabel?: string | null;
  },
  paid = false
): string {
  const bits = [
    order.tierName,
    order.interval.toLowerCase(),
    order.amountLabel,
    paid && order.recurring ? "auto-renew" : order.recurring ? "recurring" : null,
    order.offerName ? `offer ${order.offerName}` : null,
    order.creditLabel ? `credit ${order.creditLabel}` : null,
  ];
  return bits.filter(Boolean).join(" · ");
}

function iso(date: Date): string {
  return date.toISOString();
}

function auditDetail(entry: { success: boolean; metadata: unknown }): string {
  const chips = auditChips((entry.metadata as Prisma.JsonValue) ?? null, 4);
  const bits = chips.map((chip) => `${chip.label}: ${chip.value}`);
  if (!entry.success) bits.unshift("Failed");
  return bits.length > 0 ? bits.join(" · ") : entry.success ? "Recorded" : "Failed";
}

function auditTone(action: string, success: boolean): JourneyEvent["tone"] {
  if (!success) return "bad";
  if (action.includes("cancelled") || action.includes("expired") || action.includes("suspended")) {
    return "warn";
  }
  if (action.includes("failed") || action.includes("rejected") || action.includes("declined")) {
    return "bad";
  }
  if (action.includes("paid") || action.includes("succeeded") || action.includes("reinstated")) {
    return "ok";
  }
  return "info";
}

export function journeyKindForAction(action: string): JourneyKind {
  if (action.startsWith("kyc.") || action.startsWith("pan.") || action.startsWith("otp.")) return "identity";
  if (
    action.startsWith("membership.") &&
    (action.includes("paid") || action.includes("order") || action.includes("payment"))
  ) {
    return "payment";
  }
  if (action.startsWith("membership.")) return "membership";
  if (action.startsWith("security.")) return "access";
  if (action.startsWith("admin.")) return "admin";
  return "account";
}

export function buildUserJourney(
  input: {
    createdAt: Date;
    lastSeenAt: Date | null;
    kyc: Array<{ createdAt: Date; status: string; sessionNumber: number | null }>;
    pan: Array<{ createdAt: Date; status: string; panLast4: string }>;
    orders: Array<{
      createdAt: Date;
      paidAt: Date | null;
      cancelledAt: Date | null;
      status: string;
      interval: string;
      amountLabel: string;
      tierName: string;
      recurring: boolean;
      changeKind?: string;
      offerName?: string | null;
      creditLabel?: string | null;
    }>;
    audit: Array<{ createdAt: Date; action: string; success: boolean; metadata: unknown }>;
  },
  options?: { includeRedundantAudit?: boolean }
): JourneyEvent[] {
  const events: JourneyEvent[] = [
    {
      at: iso(input.createdAt),
      title: "Registered",
      detail: "Account created.",
      tone: "ok",
      kind: "account",
    },
  ];

  if (input.lastSeenAt) {
    events.push({
      at: iso(input.lastSeenAt),
      title: "Last seen",
      detail: "Signed in to the portal.",
      tone: "info",
      kind: "account",
    });
  }

  for (const session of input.kyc) {
    events.push({
      at: iso(session.createdAt),
      title: `Didit ${session.status.toLowerCase().replaceAll("_", " ")}`,
      detail: session.sessionNumber ? `Session #${session.sessionNumber}` : "Identity session",
      tone: session.status === "APPROVED" ? "ok" : session.status === "DECLINED" ? "bad" : "warn",
      kind: "identity",
    });
  }

  for (const row of input.pan) {
    events.push({
      at: iso(row.createdAt),
      title: `PAN ${row.status.toLowerCase()}`,
      detail: `Ending ${row.panLast4}`,
      tone: row.status === "VERIFIED" ? "ok" : row.status === "FAILED" ? "bad" : "warn",
      kind: "identity",
    });
  }

  for (const order of input.orders) {
    const paidAt = order.paidAt;
    const checkoutDistinct =
      !paidAt || Math.abs(paidAt.getTime() - order.createdAt.getTime()) > 2_000;
    if (checkoutDistinct) {
      events.push({
        at: iso(order.createdAt),
        title:
          order.status === "FAILED"
            ? "Checkout failed"
            : order.status === "CANCELLED" && !paidAt
              ? "Checkout cancelled"
              : "Checkout started",
        detail: orderLine(order),
        tone: order.status === "FAILED" ? "bad" : "info",
        kind: "payment",
      });
    }
    if (paidAt || order.status === "PAID") {
      const verb =
        order.changeKind === "UPGRADE"
          ? "Upgraded"
          : order.changeKind === "DOWNGRADE"
            ? "Downgraded"
            : order.changeKind === "INTERVAL_CHANGE"
              ? "Changed billing cycle"
              : "Payment captured";
      events.push({
        at: iso(paidAt ?? order.createdAt),
        title: verb,
        detail: orderLine(order, true),
        tone: "ok",
        kind: order.changeKind === "UPGRADE" || order.changeKind === "DOWNGRADE" ? "membership" : "payment",
      });
    }
    if (order.cancelledAt) {
      events.push({
        at: iso(order.cancelledAt),
        title: order.status === "CANCELLED" ? "Membership cancelled" : "Renewal cancelled",
        detail: order.tierName,
        tone: "warn",
        kind: "membership",
      });
    }
  }

  for (const entry of input.audit) {
    if (!options?.includeRedundantAudit && SKIP_AUDIT.has(entry.action)) continue;
    events.push({
      at: iso(entry.createdAt),
      title: auditActionLabel(entry.action),
      detail: auditDetail(entry),
      tone: auditTone(entry.action, entry.success),
      kind: journeyKindForAction(entry.action),
    });
  }

  return events.sort((a, b) => a.at.localeCompare(b.at) || a.title.localeCompare(b.title));
}
