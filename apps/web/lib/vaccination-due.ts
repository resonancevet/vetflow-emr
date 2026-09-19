/** Parse YYYY-MM-DD as a local calendar date (avoids UTC day-shift). */
export function parseDateOnly(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const VACCINE_PROTOCOL_LABELS: Record<string, string> = {
  lyme: "Lyme",
  lepto: "Leptospirosis",
  dhpp: "DHPP / DA2PP",
  fvrcp: "FVRCP",
  rabies: "Rabies",
  bordetella: "Bordetella",
  felv: "FeLV",
  rhdv2: "RHDV2",
};

/** Stable list for kit / product pickers. */
export const VACCINE_PROTOCOL_OPTIONS = (
  Object.entries(VACCINE_PROTOCOL_LABELS) as [string, string][]
).map(([key, label]) => ({ key, label }));

export const VACCINE_PROTOCOL_KEYS = VACCINE_PROTOCOL_OPTIONS.map(
  (opt) => opt.key,
);

function normalizeVaccineName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a free-text label (e.g. "Lyme", "leptospirosis") to a protocol key. */
function labelToProtocolKey(label: string): string | null {
  const n = normalizeVaccineName(label);
  for (const [key, canonical] of Object.entries(VACCINE_PROTOCOL_LABELS)) {
    if (n === key || n === normalizeVaccineName(canonical)) return key;
  }
  // Short aliases used in parenthetical combo suffixes / charts
  if (n === "dap" || n === "dapp" || n === "dappv" || n === "dhpp") return "dhpp";
  if (n === "rcp" || n === "fvrcp") return "fvrcp";
  if (n === "lepto" || n === "leptospirosis" || n === "l4") return "lepto";
  if (n === "lyme" || n === "borrelia") return "lyme";
  return null;
}

/**
 * Canonical reminder groups inferred from free-text / brand vaccine names.
 * Combo products can map to multiple protocols. Split combo history rows
 * named like "Nobivac Lyme/Lepto (Lyme)" resolve to only the parenthetical
 * protocol so each component keeps its own due date.
 */
export function vaccineProtocolKeys(name: string): string[] {
  const raw = name.trim();
  const suffix = raw.match(/\(([^)]+)\)\s*$/);
  if (suffix?.[1]) {
    const fromSuffix = labelToProtocolKey(suffix[1]);
    if (fromSuffix) return [fromSuffix];
  }

  const n = normalizeVaccineName(raw);
  const keys = new Set<string>();

  if (/lyme|borrelia/.test(n)) keys.add("lyme");
  if (/\blepto|\bleptosp|\bl4\b|da2ppl|dappv?\s*\+?\s*l\b/.test(n)) {
    keys.add("lepto");
  }
  if (/bordetella|kennel\s*cough|bronchicine|intratrac/.test(n)) {
    keys.add("bordetella");
  }
  if (/\bfelv\b|feline\s*leuk|leukocell|purevax\s*felv/.test(n)) {
    keys.add("felv");
  }
  if (/rhdv/.test(n)) keys.add("rhdv2");
  if (/rabies|imrab|defensor|rabvac/.test(n)) keys.add("rabies");
  if (
    /\bfvrcp\b|\brcp\b|rhinotracheitis|calici|panleuk|purevax\s*feline\s*3/.test(
      n,
    )
  ) {
    keys.add("fvrcp");
  }
  if (
    /\bdhpp\b|\bdappv\b|\bdapp\b|\bdap\b|\bda2pp|\bda2ppl\b|distemper|parvo|adenovirus|hepatitis|parainfluenza|vanguard|nobivac\s*canine\s*1|duramune\s*max/.test(
      n,
    )
  ) {
    keys.add("dhpp");
  }

  if (keys.size === 0) {
    const slug = n
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64);
    keys.add(slug || "other");
  }

  return [...keys];
}

export function protocolLabel(key: string): string {
  return VACCINE_PROTOCOL_LABELS[key] ?? key;
}

/**
 * Prefer kit-configured reminder protocols when present; otherwise infer
 * from the free-text / brand vaccine name.
 */
export function resolveVaccineProtocols(opts: {
  vaccineName: string;
  reminderProtocols?: string[] | null;
}): string[] {
  const fromKit = (opts.reminderProtocols ?? []).filter((key) =>
    VACCINE_PROTOCOL_KEYS.includes(key),
  );
  if (fromKit.length > 0) return [...new Set(fromKit)];
  return vaccineProtocolKeys(opts.vaccineName);
}

type VaccinationLike = {
  id: string;
  vaccineName: string;
  administeredAt?: Date | string | null;
  nextDueDate?: string | null;
};

function administeredTime(row: VaccinationLike): number {
  return parseDateOnly(row.administeredAt)?.getTime() ?? 0;
}

/**
 * Latest administration covering each protocol (Lyme, Lepto, DHPP, …).
 * Combo product names can cover multiple protocols at once.
 */
export function latestVaccinationPerProtocol<T extends VaccinationLike>(
  vaccinations: T[],
): Map<string, T> {
  const byProtocol = new Map<string, T>();
  for (const row of vaccinations) {
    for (const key of vaccineProtocolKeys(row.vaccineName)) {
      const existing = byProtocol.get(key);
      if (!existing || administeredTime(row) >= administeredTime(existing)) {
        byProtocol.set(key, row);
      }
    }
  }
  return byProtocol;
}

export type OverdueVaccineAlert<T extends VaccinationLike = VaccinationLike> = {
  protocolKey: string;
  protocolLabel: string;
  vaccination: T;
};

/** Overdue reminders keyed by protocol, not exact product name. */
export function overdueVaccinations<T extends VaccinationLike>(
  vaccinations: T[],
  today = new Date(),
): OverdueVaccineAlert<T>[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const latest = latestVaccinationPerProtocol(vaccinations);
  const alerts: OverdueVaccineAlert<T>[] = [];

  for (const [protocolKey, vaccination] of latest) {
    const due = parseDateOnly(vaccination.nextDueDate);
    if (!due) continue;
    due.setHours(0, 0, 0, 0);
    if (due < start) {
      alerts.push({
        protocolKey,
        protocolLabel: protocolLabel(protocolKey),
        vaccination,
      });
    }
  }

  return alerts.sort((a, b) =>
    a.protocolLabel.localeCompare(b.protocolLabel),
  );
}
