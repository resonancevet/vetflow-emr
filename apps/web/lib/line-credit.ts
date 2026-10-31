export const LINE_CREDIT_KIND = "line_credit" as const;
export const PROMPT_PAYMENT_KIND = "prompt_payment" as const;

export type DiscountKind =
  | typeof LINE_CREDIT_KIND
  | typeof PROMPT_PAYMENT_KIND;

export const DEFAULT_LINE_CREDIT_LABEL = "No Charge";

type DiscountLike = {
  itemType: string;
  discountKind?: string | null;
};

/** Legacy null discount_kind rows are treated as prompt payment. */
export function isPromptPaymentDiscount(item: DiscountLike): boolean {
  return (
    item.itemType === "discount" && item.discountKind !== LINE_CREDIT_KIND
  );
}

export function isLineCreditDiscount(item: DiscountLike): boolean {
  return (
    item.itemType === "discount" && item.discountKind === LINE_CREDIT_KIND
  );
}

export function normalizeLineCreditLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Credit label is required");
  }
  return trimmed.slice(0, 500);
}
