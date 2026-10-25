import {
  PaymentInterestStatus,
  PaymentPurpose,
  type BillingInterval,
  type DonationKind,
  type PaymentInterest,
  type Prisma,
} from "@prisma/client";
import { AuditAction, recordAudit } from "./audit";
import { db } from "./db";
import { sendPaymentInterestEmail } from "./email";
import { formatInr } from "./membership";
import { DEFAULT_PAUSED_TITLE, pausedMessageFor, type PaymentSettingsRow } from "./payment-settings";
import type { RequestContext } from "./request-context";

/** Interests still waiting on the team. A repeat attempt updates one of these instead of adding a row. */
export const ACTIVE_INTEREST_STATUSES: PaymentInterestStatus[] = [
  PaymentInterestStatus.OPEN,
  PaymentInterestStatus.CONTACTED,
  PaymentInterestStatus.LINK_SENT,
];

export type InterestInput = {
  purpose: PaymentPurpose;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  amountPaise: number;
  donationKind?: DonationKind | null;
  targetSlug?: string | null;
  targetTitle: string;
  tierId?: string | null;
  interval?: BillingInterval | null;
  source?: string | null;
};

/** Same person, same thing: the row a repeat attempt should land on. */
export function interestMatchWhere(input: InterestInput): Prisma.PaymentInterestWhereInput {
  const base: Prisma.PaymentInterestWhereInput = {
    purpose: input.purpose,
    email: input.email.trim().toLowerCase(),
    status: { in: ACTIVE_INTEREST_STATUSES },
  };
  if (input.purpose === PaymentPurpose.MEMBERSHIP) {
    return { ...base, tierId: input.tierId ?? null };
  }
  return {
    ...base,
    donationKind: input.donationKind ?? null,
    targetSlug: input.targetSlug ? input.targetSlug.trim().toLowerCase() : null,
  };
}

/** "Shiksha gift" or "Field Sevak membership · yearly". */
export function interestLabel(row: {
  purpose: PaymentPurpose | string;
  targetTitle: string;
  interval?: BillingInterval | string | null;
}): string {
  if (row.purpose === PaymentPurpose.MEMBERSHIP) {
    const cycle = row.interval === "YEARLY" ? "yearly" : row.interval === "MONTHLY" ? "monthly" : null;
    return `${row.targetTitle} membership${cycle ? ` · ${cycle}` : ""}`;
  }
  return `a gift to ${row.targetTitle}`;
}

export async function recordPaymentInterest(
  input: InterestInput,
  context?: RequestContext | null
): Promise<{ interest: PaymentInterest; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const now = new Date();
  const existing = await db.paymentInterest.findFirst({
    where: interestMatchWhere(input),
    orderBy: { createdAt: "desc" },
  });

  let interest: PaymentInterest;
  if (existing) {
    interest = await db.paymentInterest.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        phone: input.phone?.trim() || existing.phone,
        amountPaise: input.amountPaise,
        targetTitle: input.targetTitle,
        interval: input.interval ?? existing.interval,
        userId: input.userId ?? existing.userId,
        source: input.source ?? existing.source,
        attempts: { increment: 1 },
        lastAttemptAt: now,
      },
    });
  } else {
    interest = await db.paymentInterest.create({
      data: {
        purpose: input.purpose,
        userId: input.userId ?? null,
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        amountPaise: input.amountPaise,
        donationKind: input.donationKind ?? null,
        targetSlug: input.targetSlug ? input.targetSlug.trim().toLowerCase() : null,
        targetTitle: input.targetTitle,
        tierId: input.tierId ?? null,
        interval: input.interval ?? null,
        source: input.source ?? null,
        lastAttemptAt: now,
      },
    });
  }

  await recordAudit({
    action: AuditAction.PaymentInterestRecorded,
    actorUserId: input.userId ?? null,
    targetType: input.userId ? "user" : "payment_interest",
    targetId: input.userId ?? interest.id,
    context: context ?? null,
    metadata: {
      interestId: interest.id,
      purpose: input.purpose,
      what: input.targetTitle,
      amountPaise: input.amountPaise,
      repeat: Boolean(existing),
      attempts: interest.attempts,
    },
  });

  if (!existing) {
    try {
      await sendPaymentInterestEmail({
        to: email,
        name: interest.name,
        what: interestLabel(interest),
        amountPaise: interest.amountPaise,
      });
    } catch {
      // The on-screen confirmation is the promise; email is a courtesy.
    }
  }

  return { interest, created: !existing };
}

export type PausedPayload = {
  error: "payments_paused";
  title: string;
  message: string;
  interest: {
    id: string;
    what: string;
    amount: string;
    email: string;
    repeat: boolean;
  };
};

/** Body for the 409 a checkout returns while paused. Old clients show `message`; new ones open the interest window. */
export function pausedPayload(
  settings: Pick<PaymentSettingsRow, "pausedMessage">,
  interest: Pick<PaymentInterest, "id" | "purpose" | "targetTitle" | "interval" | "amountPaise" | "email" | "attempts">
): PausedPayload {
  return {
    error: "payments_paused",
    title: DEFAULT_PAUSED_TITLE,
    message: pausedMessageFor(settings),
    interest: {
      id: interest.id,
      what: interestLabel(interest),
      amount: formatInr(interest.amountPaise),
      email: interest.email,
      repeat: interest.attempts > 1,
    },
  };
}
