export type PromptPaymentDiscountMode = "percent" | "fixed";

export type PromptPaymentDiscountInput = {
  mode: PromptPaymentDiscountMode;
  /** Percent (e.g. 5 for 5%) or dollar amount, depending on mode. */
  value: number;
};

export type ComputedPromptPaymentDiscount = {
  amount: number;
  description: string;
  mode: PromptPaymentDiscountMode;
  value: number;
};

/** Compute a prompt-payment discount capped at the positive-line subtotal. */
export function computePromptPaymentDiscount(
  positiveSubtotal: number,
  input: PromptPaymentDiscountInput
): ComputedPromptPaymentDiscount {
  const subtotal = Math.max(0, Number(positiveSubtotal) || 0);
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Discount value must be greater than zero");
  }
  if (subtotal <= 0) {
    throw new Error("Nothing to discount");
  }

  let amount: number;
  let description: string;
  if (input.mode === "percent") {
    if (value > 100) {
      throw new Error("Percent discount cannot exceed 100%");
    }
    amount = Math.round(subtotal * (value / 100) * 100) / 100;
    description = `Prompt payment discount (${formatPercentLabel(value)}%)`;
  } else {
    amount = Math.round(Math.min(value, subtotal) * 100) / 100;
    description = "Prompt payment discount";
  }

  if (amount <= 0) {
    throw new Error("Discount amount must be greater than zero");
  }

  return {
    amount,
    description,
    mode: input.mode,
    value,
  };
}

function formatPercentLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
