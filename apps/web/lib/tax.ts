/** Practice-level tax helpers (stored on practices.settings). */

export const DEFAULT_TAX_RATE_PERCENT = 8;

export type PracticeSettingsJson = {
  taxRatePercent?: number;
  /** When false, invoices get $0 tax. Defaults to true. */
  taxEnabled?: boolean;
  [key: string]: unknown;
};

export function isTaxEnabled(settings: unknown): boolean {
  const raw = (settings as PracticeSettingsJson | null | undefined)?.taxEnabled;
  return raw !== false;
}

export function getTaxRatePercent(settings: unknown): number {
  const raw = (settings as PracticeSettingsJson | null | undefined)
    ?.taxRatePercent;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return DEFAULT_TAX_RATE_PERCENT;
  return n;
}

/** Rate used for invoice math — 0 when tax is turned off. */
export function getEffectiveTaxRatePercent(settings: unknown): number {
  if (!isTaxEnabled(settings)) return 0;
  return getTaxRatePercent(settings);
}

export function calcTax(
  subtotal: number,
  taxRatePercent: number = DEFAULT_TAX_RATE_PERCENT
): number {
  if (taxRatePercent <= 0) return 0;
  return Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
}
