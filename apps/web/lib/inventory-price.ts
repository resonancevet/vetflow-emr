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
