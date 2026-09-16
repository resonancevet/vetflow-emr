/** Split a dollar total into N installment amounts (cents-safe). Last gets remainder. */
export function splitInstallmentAmounts(
  totalDollars: number,
  count: number
): string[] {
  if (!Number.isFinite(totalDollars) || totalDollars < 0) {
    throw new Error("Invalid package total");
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Installment count must be a positive integer");
  }
  const cents = Math.round(totalDollars * 100);
  const base = Math.floor(cents / count);
  const amounts: string[] = [];
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const value = i === count - 1 ? cents - allocated : base;
    allocated += value;
    amounts.push((value / 100).toFixed(2));
  }
  return amounts;
}

/** Add months to a YYYY-MM-DD date; clamps day to last day of month. */
export function addMonthsToDateString(
  startDate: string,
  monthsToAdd: number
): string {
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Invalid date");
  const date = new Date(Date.UTC(y, m - 1 + monthsToAdd, 1));
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  date.setUTCDate(day);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function todayDateStringLocal(): string {
  const now = new Date();
  const yy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
