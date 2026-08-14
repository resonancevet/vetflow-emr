/** Normalize CSV/manual price strings to dollars with 2 decimal places. */
export function normalizePrice(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  s = s.replace(/[$€£¥]/g, "");
  s = s.replace(/\b(USD|CAD|EUR|GBP)\b/gi, "");
  s = s.replace(/\s/g, "");
  if (!s) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  const hadExplicitDecimal =
    hasDot || (hasComma && /^\d+[.,]\d{1,2}$/.test(s));

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(",", ".");
  } else if (hasComma) {
    s = s.replace(/,/g, "");
  }

  s = s.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s =
      s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }

  if (!s || s === ".") return null;

  let num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;

  if (!hadExplicitDecimal && Number.isInteger(num)) {
    num = num / 100;
  }

  return num.toFixed(2);
}

export function calcCostPerCount(
  unitPrice: string | number,
  quantity: number,
  count: number
): string | null {
  const price = typeof unitPrice === "string" ? parseFloat(unitPrice) : unitPrice;
  if (isNaN(price) || quantity <= 0 || count <= 0) return null;
  return (price / (quantity * count)).toFixed(4);
}

/**
 * Price to charge per inventory each on an invoice or estimate.
 * Received packs store box price on unitPrice and Cost/ct on costPrice.
 */
export function chargePriceEach(product: {
  unitPrice?: string | number | null;
  costPrice?: string | number | null;
}): string {
  const cost = parseFloat(String(product.costPrice ?? ""));
  if (Number.isFinite(cost) && cost > 0) return cost.toFixed(2);
  const unit = parseFloat(String(product.unitPrice ?? ""));
  if (Number.isFinite(unit) && unit >= 0) return unit.toFixed(2);
  return "0.00";
}

/** Apply practice inventory markup to a base unit price (Cost/ct). */
export function applyInventoryMarkup(
  basePrice: string | number,
  markupPercent: number
): string {
  const base = typeof basePrice === "string" ? parseFloat(basePrice) : basePrice;
  if (!Number.isFinite(base) || base < 0) return "0.00";
  if (!Number.isFinite(markupPercent) || markupPercent <= 0) {
    return base.toFixed(2);
  }
  return (Math.round(base * (1 + markupPercent / 100) * 100) / 100).toFixed(2);
}

/** Cost/ct (or box fallback) with optional practice markup for billing. */
export function chargePriceEachWithMarkup(
  product: {
    unitPrice?: string | number | null;
    costPrice?: string | number | null;
  },
  markupPercent: number
): string {
  return applyInventoryMarkup(chargePriceEach(product), markupPercent);
}

export function calcLineTotal(
  unitPrice: string | number,
  quantity: number
): string {
  const price = typeof unitPrice === "string" ? parseFloat(unitPrice) : unitPrice;
  return ((isNaN(price) ? 0 : price) * quantity).toFixed(2);
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
