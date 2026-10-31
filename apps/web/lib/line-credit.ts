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

/**
 * Resolve a line-credit dollar amount, defaulting to the full line total.
 * Caps at the parent line total.
 */
export function resolveLineCreditAmount(
  requested: number | null | undefined,
  lineTotal: number
): number {
  const max = Math.round(Math.max(0, Number(lineTotal) || 0) * 100) / 100;
  if (!(max > 0)) {
    throw new Error("Nothing to credit on this line");
  }
  const raw =
    requested == null || !Number.isFinite(Number(requested))
      ? max
      : Number(requested);
  if (!(raw > 0)) {
    throw new Error("Credit amount must be greater than zero");
  }
  if (raw > max + 0.001) {
    throw new Error("Credit cannot exceed the line total");
  }
  return Math.round(Math.min(raw, max) * 100) / 100;
}
