export const DUE_INTERVAL_UNITS = ["days", "weeks", "months", "years"] as const;

export type DueIntervalUnit = (typeof DUE_INTERVAL_UNITS)[number];

export function isDueIntervalUnit(value: unknown): value is DueIntervalUnit {
  return (
    typeof value === "string" &&
    (DUE_INTERVAL_UNITS as readonly string[]).includes(value)
  );
}

export function formatDueInterval(
  value: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (!value || value < 1 || !isDueIntervalUnit(unit)) return null;
  const singular = { days: "day", weeks: "week", months: "month", years: "year" };
  const label = value === 1 ? singular[unit] : unit;
  return `${value} ${label}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDueInterval(
  fromDate: string,
  value: number,
  unit: string | null | undefined
): string | null {
  if (!value || value < 1 || !isDueIntervalUnit(unit)) return null;
  const date = parseDateOnly(fromDate);
  if (!date) return null;
  switch (unit) {
    case "days":
      date.setDate(date.getDate() + value);
      break;
    case "weeks":
      date.setDate(date.getDate() + value * 7);
      break;
    case "months":
      date.setMonth(date.getMonth() + value);
      break;
    case "years":
      date.setFullYear(date.getFullYear() + value);
      break;
  }
  return toDateInput(date);
}
