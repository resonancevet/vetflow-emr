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
