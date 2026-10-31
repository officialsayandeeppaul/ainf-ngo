import { NON_REFUNDABLE_PAYMENT } from "@/lib/payment-policy";

/** Asterisk beside a paid amount or price. A RefundFootnote in the same section says what it means. */
export function RefundStar() {
  return (
    <span className="pt-refund-star" aria-hidden="true">
      *
    </span>
  );
}

export function RefundFootnote({ text = NON_REFUNDABLE_PAYMENT, inset = false }: { text?: string; inset?: boolean }) {
  return (
    <p className={`pt-refund-foot${inset ? " pt-refund-foot--inset" : ""}`}>
      <span aria-hidden="true">*</span> {text}
    </p>
  );
}
