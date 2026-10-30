/**
 * Payment policy wording, shown wherever someone pays AINF (donation forms,
 * membership plans, payment links, receipts, emails). One place, so every
 * surface says the same thing. ainf-page-boot.js carries the same sentences
 * for the Framer pages, which cannot import this module.
 */

/** Small print beside a price or under a pay button. */
export const NON_REFUNDABLE_SHORT = "Non-refundable";

export const NON_REFUNDABLE_DONATION = "Donations are non-refundable once paid.";

export const NON_REFUNDABLE_MEMBERSHIP = "Membership fees are non-refundable once paid.";

export const NON_REFUNDABLE_PAYMENT = "All payments to AINF are non-refundable once paid.";

export const NON_REFUNDABLE_RECEIPT =
  "Donations to AINF are non-refundable once paid. Keep this receipt for your records.";
