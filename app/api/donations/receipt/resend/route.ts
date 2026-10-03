import { z } from "zod";
import { DonationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { absoluteUrl, isDatabaseConfigured } from "@/lib/env";
import { sendDonationReceiptEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/ratelimit";
import { contextFromRequest } from "@/lib/request-context";
import {
  RECEIPT_LOOKUP_NEUTRAL_MESSAGE,
  selectRecoverableReceipts,
} from "@/lib/receipt-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email().max(200),
});

/**
 * Guest receipt recovery. Re-sends receipt links to the mailbox that made the
 * gift. Always answers the same neutral way so nobody can use it to learn
 * whether an address has given, or how much.
 */
export async function POST(request: Request) {
  // The neutral reply is returned on every path below, configured or not.
  const neutral = Response.json({ ok: true, message: RECEIPT_LOOKUP_NEUTRAL_MESSAGE });

  if (!isDatabaseConfigured) return neutral;

  const context = contextFromRequest(request);
  const throttle = await checkRateLimit("donate", `receipt-resend:${context.ip}`);
  if (!throttle.success) return rateLimitResponse(throttle, "donate");

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    // Even a malformed email gets the neutral answer — no probing signal.
    return neutral;
  }

  const donorEmail = input.email.toLowerCase();
  const rows = await db.donation.findMany({
    where: {
      donorEmail,
      status: { in: [DonationStatus.PAID, DonationStatus.REFUNDED] },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      receiptToken: true,
      targetTitle: true,
      amountPaise: true,
      donorName: true,
      donorEmail: true,
      status: true,
    },
  });

  const receipts = selectRecoverableReceipts(rows);
  await Promise.all(
    receipts.map((receipt) =>
      sendDonationReceiptEmail({
        to: receipt.donorEmail,
        name: receipt.donorName,
        amountPaise: receipt.amountPaise,
        targetTitle: receipt.targetTitle,
        receiptUrl: absoluteUrl(`/donate/receipt/${receipt.receiptToken}`),
      }).catch(() => undefined)
    )
  );

  return neutral;
}
