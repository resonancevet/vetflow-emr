const DEFAULT_PRACTICE_TIMEZONE = "America/New_York";

export function resolvePracticeTimezone(timezone?: string | null): string {
  const value = timezone?.trim();
  return value || DEFAULT_PRACTICE_TIMEZONE;
}

/** Format an instant for client-facing emails/SMS in the practice timezone. */
export function formatPracticeDate(
  d: Date | string,
  timezone?: string | null,
): string {
  return new Date(d).toLocaleDateString("en-US", {
    timeZone: resolvePracticeTimezone(timezone),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPracticeTime(
  d: Date | string,
  timezone?: string | null,
): string {
  return new Date(d).toLocaleTimeString("en-US", {
    timeZone: resolvePracticeTimezone(timezone),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format a calendar visit date (YYYY-MM-DD) without timezone day-shift. */
export function formatVisitDate(d: Date | string | null | undefined): string {
  if (!d) return "No date";
  if (typeof d === "string") {
    const match = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return new Date(year, month - 1, day).toLocaleDateString("en-US");
    }
  }
  return new Date(d).toLocaleDateString("en-US");
}

export function toVisitDateInput(d?: Date | string | null): string {
  if (typeof d === "string") {
    const match = d.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1]!;
  }
  const date = d ? new Date(d) : new Date();
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
