import { and, eq, isNull } from "drizzle-orm";
import { problemList } from "@openpims/db";
import type { Database } from "@openpims/db/client";

export function diagnosisDate(value: Date | string | null | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDiagnosisProblems(diagnosis: string): string[] {
  return diagnosis
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s+)/, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isWellnessAssessment(line))
    .map((line) => line.slice(0, 500));
}

/** Wellness / NSF lines stay on the SOAP Assessment and do not become problems. */
export function isWellnessAssessment(text: string): boolean {
  const key = normalizeDescription(text);
  if (!key) return false;
  return (
    /^((apparently|appears)\s+)?healthy(\s+(patient|animal|pet|dog|cat))?$/.test(key) ||
    /^(routine\s+|annual\s+)?wellness(\s+exam)?$/.test(key) ||
    /^(nsf|nan|wnl)$/.test(key) ||
    /^no significant findings?$/.test(key) ||
    /^within normal limits$/.test(key) ||
    /^normal( physical)? exam$/.test(key) ||
    /^no abnormalities noted$/.test(key) ||
    /^(pe|exam|physical exam)\s+wnl$/.test(key) ||
    /^healthy\s*[,/–—-]\s*(nsf|nan|wnl|wellness( exam)?)$/.test(key)
  );
}

function normalizeDescription(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(/\.+$/, "").toLowerCase();
}

export async function addProblemsFromDiagnosis(
  db: Database,
  input: {
    practiceId: string;
    patientId: string;
    assessment?: string | null;
    onsetDate?: string | null;
  }
) {
  const descriptions = parseDiagnosisProblems(input.assessment ?? "");
  if (descriptions.length === 0) return;

  const existing = await db
    .select({
      description: problemList.description,
      status: problemList.status,
    })
    .from(problemList)
    .where(
      and(
        eq(problemList.patientId, input.patientId),
        eq(problemList.practiceId, input.practiceId),
        isNull(problemList.deletedAt)
      )
    );

  const activeKeys = new Set(
    existing
      .filter((problem) => problem.status !== "resolved")
      .map((problem) => normalizeDescription(problem.description))
  );

  const onsetDate = input.onsetDate || diagnosisDate(new Date());
  const toInsert: Array<{
    practiceId: string;
    patientId: string;
    description: string;
    status: "active";
    onsetDate: string;
  }> = [];
  const seen = new Set<string>();

  for (const description of descriptions) {
    const key = normalizeDescription(description);
    if (!key || seen.has(key) || activeKeys.has(key)) continue;
    seen.add(key);
    toInsert.push({
      practiceId: input.practiceId,
      patientId: input.patientId,
      description,
      status: "active",
      onsetDate,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(problemList).values(toInsert);
  }
}
