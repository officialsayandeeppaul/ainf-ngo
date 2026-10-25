import { PaymentInterestStatus, PaymentLinkStatus, type Prisma } from "@prisma/client";
import { db } from "./db";
import { formatDay, formatDayTime } from "./format-date";
import { formatInr } from "./membership";
import { interestLabel } from "./payment-interest";

/** A request saved while payments were paused, as the member sees it. */
export type SavedInterest = {
  id: string;
  what: string;
  amount: string;
  status: "OPEN" | "CONTACTED" | "LINK_SENT" | "PAID" | "DISMISSED";
  when: string;
  payUrl: string | null;
  payUntil: string | null;
};

/** Open and recently settled requests for one person, with the live pay link if there is one. */
export async function loadSavedInterests(where: Prisma.PaymentInterestWhereInput, take = 12): Promise<SavedInterest[]> {
  try {
    const now = new Date();
    const rows = await db.paymentInterest.findMany({
      where: { ...where, status: { not: PaymentInterestStatus.DISMISSED } },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        links: {
          where: { status: PaymentLinkStatus.CREATED },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return rows.map((row) => {
      const link = row.links[0];
      const live = Boolean(link?.shortUrl) && (!link?.expiresAt || link.expiresAt.getTime() > now.getTime());
      return {
        id: row.id,
        what: interestLabel(row),
        amount: formatInr(link?.amountPaise ?? row.amountPaise),
        status: row.status,
        when: formatDayTime(row.lastAttemptAt),
        payUrl: live ? (link?.shortUrl ?? null) : null,
        payUntil: live && link?.expiresAt ? formatDay(link.expiresAt) : null,
      };
    });
  } catch (error) {
    console.warn("[payments] saved interests unavailable", error);
    return [];
  }
}
