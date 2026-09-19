/** Parse YYYY-MM-DD as a local calendar date (avoids UTC day-shift). */
export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type VaccinationLike = {
  id: string;
  vaccineName: string;
  administeredAt?: Date | string | null;
  nextDueDate?: string | null;
};

/**
 * For due/overdue checks, only the most recent administration of each vaccine
 * name matters — older rows with past next-due dates should not keep alerting
 * after a booster is given.
 */
export function latestVaccinationPerName<T extends VaccinationLike>(
  vaccinations: T[],
): T[] {
  const byName = new Map<string, T>();
  for (const row of vaccinations) {
    const key = row.vaccineName.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, row);
      continue;
    }
    const rowTime = parseDateOnly(row.administeredAt)?.getTime() ?? 0;
    const existingTime =
      parseDateOnly(existing.administeredAt)?.getTime() ?? 0;
    if (rowTime >= existingTime) byName.set(key, row);
  }
  return [...byName.values()];
}

export function overdueVaccinations<T extends VaccinationLike>(
  vaccinations: T[],
  today = new Date(),
): T[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  return latestVaccinationPerName(vaccinations).filter((v) => {
    const due = parseDateOnly(v.nextDueDate);
    if (!due) return false;
    due.setHours(0, 0, 0, 0);
    return due < start;
  });
}
