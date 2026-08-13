import { z } from "zod";

export type WeightUnit = "kg" | "lb";
export type TempUnit = "C" | "F";
export type FindingStatus = "wnl" | "abnormal" | "not_examined";

export type PeFinding = {
  status: FindingStatus | "";
  notes: string;
};

export const PE_SYSTEMS = [
  { key: "eyes", label: "Eyes" },
  { key: "ears", label: "Ears" },
  { key: "nasal", label: "Nasal" },
  { key: "oralDental", label: "Oral / dental" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "respiratory", label: "Respiratory" },
  { key: "neurological", label: "Neurological" },
  { key: "musculoskeletal", label: "Musculoskeletal" },
  { key: "lymphatic", label: "Lymphatic" },
  { key: "gastrointestinal", label: "Gastrointestinal" },
  { key: "reproUrinary", label: "Reproductive / urinary" },
  { key: "integument", label: "Integument" },
] as const;

export type PeSystemKey = (typeof PE_SYSTEMS)[number]["key"];

export const EMPTY_FINDING: PeFinding = { status: "", notes: "" };

export const MM_OPTIONS = [
  "Pink and moist",
  "Pale",
  "Icteric",
  "Cyanotic",
  "Injected / hyperemic",
  "Petechiae / ecchymoses",
  "Tacky / dry",
];

export const HYDRATION_OPTIONS = [
  "Adequate",
  "Mild dehydration (~5%)",
  "Moderate dehydration (~8%)",
  "Severe dehydration (~10%+)",
  "Overhydrated",
];

export const BCS_OPTIONS = [
  "1/9 — Emaciated",
  "2/9 — Very thin",
  "3/9 — Thin",
  "4/9 — Underweight",
  "5/9 — Ideal",
  "6/9 — Slightly overweight",
  "7/9 — Overweight",
  "8/9 — Obese",
  "9/9 — Severely obese",
];

export const MENTATION_OPTIONS = [
  "BAR (bright, alert, responsive)",
  "QAR (quiet, alert, responsive)",
  "Dull",
  "Obtunded",
  "Stuporous",
  "Comatose",
  "Agitated",
];

export const FAS_OPTIONS = [
  "0 — Relaxed",
  "1 — Mild FAS",
  "2 — Mild–moderate FAS",
  "3 — Moderate FAS",
  "4 — Severe FAS",
  "5 — Extreme / panic",
];

export type SoapFormDraft = {
  reasonForVisit: string;
  history: string;
  weight: string;
  weightUnit: WeightUnit;
  temperature: string;
  tempUnit: TempUnit;
  heartRate: string;
  respiratoryRate: string;
  crt: string;
  mucousMembrane: string;
  hydration: string;
  bodyCondition: string;
  mentation: string;
  pain: string;
  fas: string;
  peFindings: Record<PeSystemKey, PeFinding>;
  assessment: string;
  plan: string;
};

const peFindingSchema = z.object({
  status: z.enum(["wnl", "abnormal", "not_examined", ""]).optional(),
  notes: z.string().optional(),
});

export const soapFormDraftSchema = z.object({
  reasonForVisit: z.string().optional(),
  history: z.string().optional(),
  weight: z.string().optional(),
  weightUnit: z.enum(["kg", "lb"]).optional(),
  temperature: z.string().optional(),
  tempUnit: z.enum(["C", "F"]).optional(),
  heartRate: z.string().optional(),
  respiratoryRate: z.string().optional(),
  crt: z.string().optional(),
  mucousMembrane: z.string().optional(),
  hydration: z.string().optional(),
  bodyCondition: z.string().optional(),
  mentation: z.string().optional(),
  pain: z.string().optional(),
  fas: z.string().optional(),
  peFindings: z.record(z.string(), peFindingSchema).optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

export function emptyPeFindings(): Record<PeSystemKey, PeFinding> {
  return Object.fromEntries(
    PE_SYSTEMS.map((system) => [system.key, { ...EMPTY_FINDING }])
  ) as Record<PeSystemKey, PeFinding>;
}

export function emptySoapFormDraft(): SoapFormDraft {
  return {
    reasonForVisit: "",
    history: "",
    weight: "",
    weightUnit: "kg",
    temperature: "",
    tempUnit: "F",
    heartRate: "",
    respiratoryRate: "",
    crt: "",
    mucousMembrane: "",
    hydration: "",
    bodyCondition: "",
    mentation: "",
    pain: "",
    fas: "",
    peFindings: emptyPeFindings(),
    assessment: "",
    plan: "",
  };
}

export function normalizeSoapFormDraft(
  raw: unknown,
  fallbackUnit: WeightUnit = "kg"
): SoapFormDraft {
  const parsed = soapFormDraftSchema.safeParse(raw);
  const base = emptySoapFormDraft();
  base.weightUnit = fallbackUnit;
  if (!parsed.success) return base;
  const d = parsed.data;
  const pe = emptyPeFindings();
  for (const system of PE_SYSTEMS) {
    const finding = d.peFindings?.[system.key];
    if (!finding) continue;
    const status = finding.status ?? "";
    pe[system.key] = {
      status:
        status === "wnl" || status === "abnormal" || status === "not_examined"
          ? status
          : "",
      notes: finding.notes ?? "",
    };
  }
  return {
    reasonForVisit: d.reasonForVisit ?? "",
    history: d.history ?? "",
    weight: d.weight ?? "",
    weightUnit: d.weightUnit ?? fallbackUnit,
    temperature: d.temperature ?? "",
    tempUnit: d.tempUnit ?? "F",
    heartRate: d.heartRate ?? "",
    respiratoryRate: d.respiratoryRate ?? "",
    crt: d.crt ?? "",
    mucousMembrane: d.mucousMembrane ?? "",
    hydration: d.hydration ?? "",
    bodyCondition: d.bodyCondition ?? "",
    mentation: d.mentation ?? "",
    pain: d.pain ?? "",
    fas: d.fas ?? "",
    peFindings: pe,
    assessment: d.assessment ?? "",
    plan: d.plan ?? "",
  };
}

function labeledLines(
  rows: Array<[string, string | undefined | null]>
): string {
  return rows
    .map(([label, value]) => [label, value?.trim() ?? ""] as const)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export function statusLabel(status: FindingStatus | ""): string {
  if (status === "wnl") return "WNL";
  if (status === "abnormal") return "Abnormal";
  if (status === "not_examined") return "Not examined";
  return "";
}

export function composeSubjective(input: {
  reasonForVisit: string;
  history: string;
}): string | undefined {
  const text = labeledLines([
    ["Reason for visit", input.reasonForVisit],
    ["History, concerns, and owner's observations", input.history],
  ]);
  return text || undefined;
}

export function composeObjective(input: {
  weight: string;
  weightUnit: WeightUnit;
  temperature: string;
  tempUnit: TempUnit;
  heartRate: string;
  respiratoryRate: string;
  crt: string;
  crtProlonged: boolean;
  mucousMembrane: string;
  hydration: string;
  bodyCondition: string;
  mentation: string;
  pain: string;
  fas: string;
  peFindings: Record<PeSystemKey, PeFinding>;
}): string | undefined {
  const vitals = labeledLines([
    [
      "Weight",
      input.weight.trim()
        ? `${input.weight.trim()} ${input.weightUnit}`
        : "",
    ],
    [
      "Temperature",
      input.temperature.trim()
        ? `${input.temperature.trim()} °${input.tempUnit}`
        : "",
    ],
    ["Heart rate", input.heartRate.trim() ? `${input.heartRate.trim()} bpm` : ""],
    [
      "Respiration rate",
      input.respiratoryRate.trim()
        ? `${input.respiratoryRate.trim()} bpm`
        : "",
    ],
    [
      "Capillary refill time",
      input.crt.trim()
        ? `${input.crt.trim()} sec${input.crtProlonged ? " (prolonged)" : ""}`
        : "",
    ],
    ["Mucous membranes", input.mucousMembrane],
    ["Hydration", input.hydration],
    ["Body condition", input.bodyCondition],
    ["Mentation", input.mentation],
    ["Pain", input.pain ? `${input.pain}/10` : ""],
    ["Fear / anxiety / stress", input.fas],
  ]);

  const pe = PE_SYSTEMS.map((system) => {
    const finding = input.peFindings[system.key];
    const status = statusLabel(finding.status);
    const notes = finding.notes.trim();
    if (!status && !notes) return null;
    if (status && notes) return `${system.label}: ${status} — ${notes}`;
    if (status) return `${system.label}: ${status}`;
    return `${system.label}: ${notes}`;
  }).filter(Boolean);

  const parts = [
    vitals && `Vitals\n${vitals}`,
    pe.length > 0 && `Physical exam\n${pe.join("\n")}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

export function inferExamStatus(
  peFindings: Record<PeSystemKey, PeFinding>
): "wnl" | "abnormal" | "not_examined" {
  const statuses = Object.values(peFindings)
    .map((finding) => finding.status)
    .filter((status): status is FindingStatus => Boolean(status));
  if (statuses.length === 0) return "wnl";
  if (statuses.some((status) => status === "abnormal")) return "abnormal";
  if (statuses.every((status) => status === "not_examined")) return "not_examined";
  return "wnl";
}

function extractLabeled(text: string, labels: string[]): Record<string, string> {
  const escaped = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const re = new RegExp(`^(${escaped.join("|")}): `, "gm");
  const matches: { label: string; start: number; valueStart: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    matches.push({
      label: match[1]!,
      start: match.index,
      valueStart: match.index + match[0].length,
    });
  }
  const result: Record<string, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1]!.start : text.length;
    result[matches[i]!.label] = text.slice(matches[i]!.valueStart, end).trim();
  }
  return result;
}

function sectionAfterHeading(text: string, heading: string): string {
  const parts = text.split(/\n\n+/);
  for (const part of parts) {
    const lines = part.split("\n");
    if (lines[0]?.trim() === heading) return lines.slice(1).join("\n");
  }
  return "";
}

const PE_LABEL_TO_KEY = Object.fromEntries(
  PE_SYSTEMS.map((system) => [system.label, system.key])
) as Record<string, PeSystemKey>;

function parseFindingStatus(label: string): FindingStatus | "" {
  if (label === "WNL") return "wnl";
  if (label === "Abnormal") return "abnormal";
  if (label === "Not examined") return "not_examined";
  return "";
}

export function parseComposedSoap(note: {
  reasonForVisit?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}): SoapFormDraft {
  const draft = emptySoapFormDraft();
  draft.reasonForVisit = note.reasonForVisit?.trim() ?? "";
  draft.assessment = note.assessment ?? "";
  draft.plan = note.plan ?? "";

  const subjective = note.subjective?.trim() ?? "";
  if (subjective) {
    const fields = extractLabeled(subjective, [
      "Reason for visit",
      "History, concerns, and owner's observations",
    ]);
    if (fields["Reason for visit"]) {
      draft.reasonForVisit = fields["Reason for visit"];
    }
    if (fields["History, concerns, and owner's observations"]) {
      draft.history = fields["History, concerns, and owner's observations"];
    } else if (!fields["Reason for visit"]) {
      draft.history = subjective;
    }
  }

  const objective = note.objective?.trim() ?? "";
  if (!objective) return draft;

  const vitals = extractLabeled(sectionAfterHeading(objective, "Vitals") || objective, [
    "Weight",
    "Temperature",
    "Heart rate",
    "Respiration rate",
    "Capillary refill time",
    "Mucous membranes",
    "Hydration",
    "Body condition",
    "Mentation",
    "Pain",
    "Fear / anxiety / stress",
  ]);

  const weightMatch = vitals.Weight?.match(/^(.+?)\s+(kg|lb)$/i);
  if (weightMatch) {
    draft.weight = weightMatch[1]!.trim();
    draft.weightUnit = weightMatch[2]!.toLowerCase() === "lb" ? "lb" : "kg";
  }

  const tempMatch = vitals.Temperature?.match(/^(.+?)\s+°\s*([CF])$/i);
  if (tempMatch) {
    draft.temperature = tempMatch[1]!.trim();
    draft.tempUnit = tempMatch[2]!.toUpperCase() === "C" ? "C" : "F";
  }

  draft.heartRate = vitals["Heart rate"]?.replace(/\s*bpm$/i, "").trim() ?? "";
  draft.respiratoryRate =
    vitals["Respiration rate"]?.replace(/\s*bpm$/i, "").trim() ?? "";
  draft.crt =
    vitals["Capillary refill time"]
      ?.replace(/\s*\(prolonged\)/i, "")
      .replace(/\s*sec$/i, "")
      .trim() ?? "";
  draft.mucousMembrane = vitals["Mucous membranes"] ?? "";
  draft.hydration = vitals.Hydration ?? "";
  draft.bodyCondition = vitals["Body condition"] ?? "";
  draft.mentation = vitals.Mentation ?? "";
  draft.pain = vitals.Pain?.replace(/\/10$/, "").trim() ?? "";
  draft.fas = vitals["Fear / anxiety / stress"] ?? "";

  const peText = sectionAfterHeading(objective, "Physical exam");
  if (peText) {
    for (const line of peText.split("\n")) {
      const match = line.match(/^(.+?): (WNL|Abnormal|Not examined)(?: — (.*))?$/);
      if (match) {
        const key = PE_LABEL_TO_KEY[match[1]!.trim()];
        if (!key) continue;
        draft.peFindings[key] = {
          status: parseFindingStatus(match[2]!),
          notes: match[3]?.trim() ?? "",
        };
        continue;
      }
      const notesOnly = line.match(/^(.+?): (.*)$/);
      if (notesOnly) {
        const key = PE_LABEL_TO_KEY[notesOnly[1]!.trim()];
        if (!key) continue;
        draft.peFindings[key] = {
          status: "",
          notes: notesOnly[2]!.trim(),
        };
      }
    }
  }

  return draft;
}

export function soapFormFromNote(
  note: {
    reasonForVisit?: string | null;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    formDraft?: unknown;
  },
  fallbackUnit: WeightUnit = "kg"
): SoapFormDraft {
  if (note.formDraft != null) {
    return normalizeSoapFormDraft(note.formDraft, fallbackUnit);
  }
  return parseComposedSoap(note);
}
