"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, NotebookText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type CachedPatientSnapshot,
  getCachedPatientSnapshot,
  OFFLINE_CACHE_CHANGED,
} from "@/lib/offline/cache";

const speciesEmoji: Record<string, string> = {
  canine: "\uD83D\uDC36",
  feline: "\uD83D\uDC31",
  avian: "\uD83D\uDC26",
  rabbit: "\uD83D\uDC30",
  reptile: "\uD83E\uDD8E",
  equine: "\uD83D\uDC34",
  other: "\uD83D\uDC3E",
};

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function asString(value: unknown, fallback = "\u2014"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function calculateAge(dob: unknown): string {
  if (typeof dob !== "string" || !dob) return "Unknown";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "Unknown";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years === 0) return `${months} month${months !== 1 ? "s" : ""}`;
  if (months === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${months}m`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          "Offline chart storage is taking longer than expected. Try Retry, or fully close and reopen Safari."
        )
      );
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default function OfflineChartDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CachedPatientSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoading(true);
      setError(null);
      withTimeout(getCachedPatientSnapshot(params.id), 7000)
        .then((entry) => {
          if (!cancelled) setSnapshot(entry ?? null);
        })
        .catch((err) => {
          console.error(err);
          if (!cancelled) {
            setSnapshot(null);
            setError(
              err instanceof Error
                ? err.message
                : "Unable to read this cached chart."
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();
    const handle = () => load();
    window.addEventListener(OFFLINE_CACHE_CHANGED, handle);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_CACHE_CHANGED, handle);
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading cached chart...
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/offline-charts")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Offline Charts
        </Button>
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <NotebookText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          {error ? (
            <>
              <p className="mt-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                Offline chart did not load.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                No cached chart for this patient on this device.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the patient online or use &ldquo;Prepare for field
                day&rdquo; on the Schedule page to cache them.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const p = snapshot.patient;
  const owner = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/offline-charts")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Offline Charts
        </Button>
        <p className="text-xs text-muted-foreground">
          Cached {formatDateTime(snapshot.cachedAt)}
          {" \u00B7 read-only snapshot"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
            {speciesEmoji[p.species ?? "other"] ?? "\uD83D\uDC3E"}
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold">{p.name}</h2>
            <p className="text-sm text-muted-foreground">
              {p.species
                ? p.species.charAt(0).toUpperCase() + p.species.slice(1)
                : "Unknown"}
              {p.breed ? ` \u00B7 ${p.breed}` : ""}
              {" \u00B7 "}
              {calculateAge(p.dob)}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {p.color && <span>Color: {p.color}</span>}
              {p.microchipNumber && (
                <span>Microchip: {p.microchipNumber}</span>
              )}
            </div>
            {owner && (
              <p className="mt-2 text-sm text-muted-foreground">
                Owner: {owner}
                {p.clientPhone ? ` \u00B7 ${p.clientPhone}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      <SnapshotSection title="Active alerts" empty="No alerts">
        {snapshot.alerts.map((alert, i) => (
          <li
            key={asString(alert.id, String(i))}
            className="rounded border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-900 dark:bg-amber-950/30"
          >
            <p className="font-medium">{asString(alert.title)}</p>
            <p className="text-xs text-muted-foreground">
              {asString(alert.type)} \u00B7 {asString(alert.severity)}
            </p>
            {alert.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-xs">
                {asString(alert.notes)}
              </p>
            ) : null}
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Allergies" empty="No allergies recorded">
        {snapshot.allergies.map((a, i) => (
          <li
            key={asString(a.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(a.allergen)}</p>
            <p className="text-xs text-muted-foreground">
              Severity: {asString(a.severity)}
              {a.reaction ? ` \u00B7 ${asString(a.reaction)}` : ""}
            </p>
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Problems" empty="No problems recorded">
        {snapshot.problems.map((problem, i) => (
          <li
            key={asString(problem.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(problem.description)}</p>
            <p className="text-xs text-muted-foreground">
              Status: {asString(problem.status)}
              {problem.onsetDate
                ? ` \u00B7 onset ${formatDate(problem.onsetDate)}`
                : ""}
            </p>
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Vaccinations" empty="No vaccinations recorded">
        {snapshot.vaccinations.map((v, i) => (
          <li
            key={asString(v.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(v.vaccineName)}</p>
            <p className="text-xs text-muted-foreground">
              Given {formatDate(v.administeredAt)}
              {v.nextDueDate ? ` \u00B7 next ${formatDate(v.nextDueDate)}` : ""}
              {v.administeredByName ? ` \u00B7 by ${asString(v.administeredByName)}` : ""}
            </p>
            {v.lotNumber || v.manufacturer ? (
              <p className="text-xs text-muted-foreground">
                {v.manufacturer ? asString(v.manufacturer) : ""}
                {v.lotNumber ? ` lot ${asString(v.lotNumber)}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Active prescriptions" empty="No prescriptions">
        {snapshot.prescriptions.map((rx, i) => (
          <li
            key={asString(rx.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(rx.medicationName)}</p>
            <p className="text-xs text-muted-foreground">
              {asString(rx.dosage)} \u00B7 {asString(rx.frequency)}
              {rx.status ? ` \u00B7 ${asString(rx.status)}` : ""}
            </p>
            {rx.instructions ? (
              <p className="mt-1 text-xs">{asString(rx.instructions)}</p>
            ) : null}
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection
        title="Recent SOAP notes"
        empty="No SOAP notes recorded"
      >
        {snapshot.soapNotes.map((note, i) => (
          <li
            key={asString(note.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="text-xs text-muted-foreground">
              {formatDateTime(note.createdAt)}
              {note.authorName ? ` \u00B7 ${asString(note.authorName)}` : ""}
            </p>
            <SoapField label="S" value={note.subjective} />
            <SoapField label="O" value={note.objective} />
            <SoapField label="A" value={note.assessment} />
            <SoapField label="P" value={note.plan} />
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Lab results" empty="No lab results">
        {snapshot.labResults.map((lab, i) => (
          <li
            key={asString(lab.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(lab.testName)}</p>
            <p className="text-xs text-muted-foreground">
              {asString(lab.resultValue, "")}
              {lab.unit ? ` ${asString(lab.unit)}` : ""}
              {lab.referenceRangeLow || lab.referenceRangeHigh
                ? ` (ref ${asString(lab.referenceRangeLow, "")}-${asString(lab.referenceRangeHigh, "")})`
                : ""}
              {" \u00B7 "}
              {asString(lab.status)}
              {" \u00B7 "}
              {formatDate(lab.createdAt)}
            </p>
          </li>
        ))}
      </SnapshotSection>

      <SnapshotSection title="Procedures" empty="No procedures recorded">
        {snapshot.procedures.map((proc, i) => (
          <li
            key={asString(proc.id, String(i))}
            className="rounded border border-border p-2 text-sm"
          >
            <p className="font-medium">{asString(proc.name)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(proc.createdAt)}
              {proc.performedByName ? ` \u00B7 ${asString(proc.performedByName)}` : ""}
              {proc.durationMinutes ? ` \u00B7 ${asString(proc.durationMinutes)} min` : ""}
            </p>
            {proc.description ? (
              <p className="mt-1 text-xs">{asString(proc.description)}</p>
            ) : null}
            {proc.notes ? (
              <p className="mt-1 text-xs whitespace-pre-wrap">
                {asString(proc.notes)}
              </p>
            ) : null}
          </li>
        ))}
      </SnapshotSection>
    </div>
  );
}

function SnapshotSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.length > 0 && items.some((c) => c !== null && c !== undefined);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      {hasItems ? (
        <ul className="mt-3 space-y-2">{children}</ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function SoapField({ label, value }: { label: string; value: unknown }) {
  if (typeof value !== "string" || !value.trim()) return null;
  return (
    <div className="mt-1 text-xs">
      <span className="font-semibold">{label}:</span>{" "}
      <span className="whitespace-pre-wrap">{value}</span>
    </div>
  );
}
