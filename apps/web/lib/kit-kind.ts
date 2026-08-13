export const KIT_KINDS = ["vaccine", "lab"] as const;

export type KitKind = (typeof KIT_KINDS)[number];

export function isKitKind(value: unknown): value is KitKind {
  return (
    typeof value === "string" &&
    (KIT_KINDS as readonly string[]).includes(value)
  );
}

export function kitKindLabel(kind: string | null | undefined): string {
  if (kind === "lab") return "Lab";
  return "Vaccine";
}
