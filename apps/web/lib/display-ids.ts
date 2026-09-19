/** Client display IDs: C0042. Patient: P0042-01. */

export const CLIENT_SEQ_WIDTH = 4;
export const PET_SEQ_WIDTH = 2;

export function formatClientDisplayId(seq: number): string {
  return `C${String(seq).padStart(CLIENT_SEQ_WIDTH, "0")}`;
}

export function formatPatientDisplayId(
  clientSeq: number,
  petSeq: number,
): string {
  return `P${String(clientSeq).padStart(CLIENT_SEQ_WIDTH, "0")}-${String(petSeq).padStart(PET_SEQ_WIDTH, "0")}`;
}

/** Extract numeric client sequence from C0042 or P0042-01. */
export function parseClientSeqFromDisplayId(
  displayId: string | null | undefined,
): number | null {
  if (!displayId) return null;
  const match = displayId.trim().match(/^[CP]0*(\d+)/i);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Build ILIKE patterns so "42", "C42", "P42", "0042" all match C0042 / P0042-01.
 */
export function displayIdSearchPatterns(query: string): string[] {
  const q = query.trim();
  if (!q) return [];

  const patterns = new Set<string>([`%${q}%`]);

  const normalized = q.replace(/^([cCpP])-?/, "$1").replace(/\s+/g, "");
  const digitMatch = normalized.match(/^[cCpP]?(\d+)(?:-\d+)?$/i);
  if (digitMatch?.[1]) {
    const digits = digitMatch[1];
    const padded = digits.padStart(CLIENT_SEQ_WIDTH, "0");
    patterns.add(`%${digits}%`);
    patterns.add(`%${padded}%`);
    patterns.add(`C${padded}%`);
    patterns.add(`P${padded}%`);
    patterns.add(`C${digits}%`);
    patterns.add(`P${digits}%`);
  }

  return [...patterns];
}
