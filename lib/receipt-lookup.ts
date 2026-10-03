import { DonationStatus } from "@prisma/client";

/**
 * Guest receipt recovery.
 *
 * A guest who loses the receipt email can ask for it again. To avoid letting
 * anyone enumerate who gave what, the lookup never shows results on screen: it
 * only re-sends receipt links to the mailbox that made the gift, and the API
 * always answers the same neutral way whether or not any gift was found.
 */

export type RecoverableReceipt = {
  receiptToken: string;
  targetTitle: string;
  amountPaise: number;
  donorName: string;
  donorEmail: string;
  status: DonationStatus;
};

type LookupRow = {
  receiptToken: string;
  targetTitle: string;
  amountPaise: number;
  donorName: string;
  donorEmail: string;
  status: DonationStatus;
};

/** Hard cap on how many receipts one lookup will re-send, as an abuse guard. */
export const MAX_RECOVERABLE_RECEIPTS = 20;

/**
 * Keep only gifts that actually have a receipt a guest could open — a receipt
 * page 404s for CREATED/FAILED gifts — and cap the count. Pure.
 */
export function selectRecoverableReceipts(rows: LookupRow[]): RecoverableReceipt[] {
  return rows
    .filter(
      (row) =>
        (row.status === DonationStatus.PAID || row.status === DonationStatus.REFUNDED) &&
        typeof row.receiptToken === "string" &&
        row.receiptToken.length > 0
    )
    .slice(0, MAX_RECOVERABLE_RECEIPTS)
    .map((row) => ({
      receiptToken: row.receiptToken,
      targetTitle: row.targetTitle,
      amountPaise: row.amountPaise,
      donorName: row.donorName,
      donorEmail: row.donorEmail,
      status: row.status,
    }));
}

/** The one message the lookup returns, found or not, so nothing is leaked. */
export const RECEIPT_LOOKUP_NEUTRAL_MESSAGE =
  "If that email has any received gifts, we've sent the receipt links to it. Please check your inbox.";
