"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, NotebookText, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  appendCachedPatientAlert,
  appendCachedPatientProblem,
  appendCachedPatientWeight,
  type CachedPatientSnapshot,
  getCachedPatientSnapshot,
  OFFLINE_CACHE_CHANGED,
} from "@/lib/offline/cache";
import { runOrQueueMutation } from "@/lib/offline/mutations";
import { trpc } from "@/lib/trpc";
import { kgToLb, toKgString, useWeightUnit } from "@/lib/weight-units";
import { UnitToggle } from "@/components/patients/patient-clinical-add";

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
  const addWeight = trpc.patients.addWeight.useMutation();
  const createProblem = trpc.records.createProblem.useMutation();
  const createAlert = trpc.patientAlerts.create.useMutation();

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

  const addOfflineWeight = async (weightKg: string) => {
    try {
      const result = await runOrQueueMutation({
        target: "patients.addWeight",
        payload: {
          patientId: snapshot.patientId,
          weightKg,
        },
        runOnline: (payload) => addWeight.mutateAsync(payload),
      });

      const weightRow =
        result.status === "online"
          ? ({
              ...(result.result as Record<string, unknown>),
              id: (result.result as { id?: string }).id ?? `weight_${Date.now()}`,
            } as Record<string, unknown> & { id: string })
          : {
              id: `queued_${result.item.id}`,
              patientId: snapshot.patientId,
              weightKg,
              recordedAt: new Date().toISOString(),
              recordedBy: "Queued offline",
              pendingOffline: true,
            };

      const next = await appendCachedPatientWeight({
        patientId: snapshot.patientId,
        weight: weightRow,
      });
      if (next) setSnapshot(next);

      if (result.status === "queued") {
        toast.success("Weight saved offline and queued for sync.");
      } else {
        toast.success("Weight recorded.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not save weight.");
    }
  };

  const addOfflineProblem = async (input: {
    description: string;
    status: "active" | "resolved" | "chronic";
    onsetDate?: string;
  }) => {
    try {
      const result = await runOrQueueMutation({
        target: "records.createProblem",
        payload: {
          patientId: snapshot.patientId,
          description: input.description,
          status: input.status,
          onsetDate: input.onsetDate,
        },
        runOnline: (payload) => createProblem.mutateAsync(payload),
      });

      const problemRow =
        result.status === "online"
          ? ({
              ...(result.result as Record<string, unknown>),
              id:
                (result.result as { id?: string }).id ?? `problem_${Date.now()}`,
            } as Record<string, unknown> & { id: string })
          : {
              id: `queued_${result.item.id}`,
              patientId: snapshot.patientId,
              description: input.description,
              status: input.status,
              onsetDate: input.onsetDate,
              createdAt: new Date().toISOString(),
              pendingOffline: true,
            };

      const next = await appendCachedPatientProblem({
        patientId: snapshot.patientId,
        problem: problemRow,
      });
      if (next) setSnapshot(next);

      toast.success(
        result.status === "queued"
          ? "Problem saved offline and queued for sync."
          : "Problem added."
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not save problem.");
    }
  };

  const addOfflineAlert = async (input: {
    title: string;
    type: "behavior" | "medical" | "financial" | "other";
    severity: "info" | "warning" | "critical";
    notes?: string;
  }) => {
    try {
      const result = await runOrQueueMutation({
        target: "patientAlerts.create",
        payload: {
          patientId: snapshot.patientId,
          title: input.title,
          type: input.type,
          severity: input.severity,
          notes: input.notes,
        },
        runOnline: (payload) => createAlert.mutateAsync(payload),
      });

      const alertRow =
        result.status === "online"
          ? ({
              ...(result.result as Record<string, unknown>),
              id: (result.result as { id?: string }).id ?? `alert_${Date.now()}`,
            } as Record<string, unknown> & { id: string })
          : {
              id: `queued_${result.item.id}`,
              patientId: snapshot.patientId,
              title: input.title,
              type: input.type,
              severity: input.severity,
              notes: input.notes,
              createdAt: new Date().toISOString(),
              pendingOffline: true,
            };

      const next = await appendCachedPatientAlert({
        patientId: snapshot.patientId,
        alert: alertRow,
      });
      if (next) setSnapshot(next);

      toast.success(
        result.status === "queued"
          ? "Alert saved offline and queued for sync."
          : "Alert added."
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not save alert.");
    }
  };

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

      <OfflineWeightSection
        weights={snapshot.weights}
        onAddWeight={addOfflineWeight}
        saving={addWeight.isPending}
      />

      <SnapshotSection title="Active alerts" empty="No alerts">
        <OfflineAlertForm onSubmit={addOfflineAlert} saving={createAlert.isPending} />
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
        <OfflineProblemForm
          onSubmit={addOfflineProblem}
          saving={createProblem.isPending}
        />
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

function OfflineProblemForm({
  onSubmit,
  saving,
}: {
  onSubmit: (input: {
    description: string;
    status: "active" | "resolved" | "chronic";
    onsetDate?: string;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "resolved" | "chronic">(
    "active"
  );
  const [onsetDate, setOnsetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const disabled = saving || submitting;

  return (
    <li className="rounded border border-dashed border-border bg-muted/20 p-3 text-sm">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (disabled) return;
          const trimmed = description.trim();
          if (!trimmed) {
            toast.error("Enter a problem description.");
            return;
          }
          setSubmitting(true);
          try {
            await onSubmit({
              description: trimmed,
              status,
              onsetDate: onsetDate || undefined,
            });
            setDescription("");
            setStatus("active");
            setOnsetDate("");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium">
              Quick-add problem
            </label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Right hind lameness"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Status</label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as "active" | "resolved" | "chronic"
                )
              }
            >
              <option value="active">Active</option>
              <option value="chronic">Chronic</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Onset</label>
            <Input
              type="date"
              value={onsetDate}
              onChange={(event) => setOnsetDate(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={disabled}>
            {disabled ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add
          </Button>
        </div>
      </form>
    </li>
  );
}

function OfflineAlertForm({
  onSubmit,
  saving,
}: {
  onSubmit: (input: {
    title: string;
    type: "behavior" | "medical" | "financial" | "other";
    severity: "info" | "warning" | "critical";
    notes?: string;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<
    "behavior" | "medical" | "financial" | "other"
  >("medical");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">(
    "warning"
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const disabled = saving || submitting;

  return (
    <li className="rounded border border-dashed border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (disabled) return;
          const trimmedTitle = title.trim();
          if (!trimmedTitle) {
            toast.error("Enter an alert title.");
            return;
          }
          setSubmitting(true);
          try {
            await onSubmit({
              title: trimmedTitle,
              type,
              severity,
              notes: notes.trim() || undefined,
            });
            setTitle("");
            setType("medical");
            setSeverity("warning");
            setNotes("");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium">
              Quick-add alert
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Use muzzle for handling"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Type</label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(event) =>
                setType(
                  event.target.value as
                    | "behavior"
                    | "medical"
                    | "financial"
                    | "other"
                )
              }
            >
              <option value="medical">Medical</option>
              <option value="behavior">Behavior</option>
              <option value="financial">Financial</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Severity</label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={severity}
              onChange={(event) =>
                setSeverity(
                  event.target.value as "info" | "warning" | "critical"
                )
              }
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <Button type="submit" size="sm" disabled={disabled}>
            {disabled ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Add
          </Button>
        </div>
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional notes"
        />
      </form>
    </li>
  );
}

function OfflineWeightSection({
  weights,
  onAddWeight,
  saving,
}: {
  weights: Record<string, unknown>[];
  onAddWeight: (weightKg: string) => Promise<void>;
  saving: boolean;
}) {
  const [unit, setUnit] = useWeightUnit();

  const formatWeight = (kgValue: unknown) => {
    if (typeof kgValue !== "string" && typeof kgValue !== "number") return "—";
    const kg = Number(kgValue);
    if (!Number.isFinite(kg)) return String(kgValue);
    return unit === "lb" ? `${kgToLb(kg).toFixed(2)} lb` : `${kg.toFixed(2)} kg`;
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold">Weight</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the first offline write workflow. Entries made offline are
            queued and sync when the app reconnects.
          </p>
        </div>
        <UnitToggle unit={unit} onChange={setUnit} />
      </div>

      <OfflineWeightForm
        unit={unit}
        onSubmit={onAddWeight}
        saving={saving}
      />

      {weights.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[340px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Weight
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {weights.map((row, i) => (
                <tr
                  key={asString(row.id, String(i))}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2">{formatDate(row.recordedAt)}</td>
                  <td className="px-3 py-2 font-medium">
                    {formatWeight(row.weightKg)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.pendingOffline ? "Queued for sync" : "Synced"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No weights recorded.
        </p>
      )}
    </section>
  );
}

function OfflineWeightForm({
  unit,
  onSubmit,
  saving,
}: {
  unit: "kg" | "lb";
  onSubmit: (weightKg: string) => Promise<void>;
  saving: boolean;
}) {
  const [weight, setWeight] = useState("");
  // Local guard so a quick double-tap on iPad cannot submit the form twice
  // (the parent's `saving` flag only reflects the online mutation, not a
  // queued/offline submit).
  const [submitting, setSubmitting] = useState(false);
  const disabled = saving || submitting;

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled) return;
        const kg = toKgString(weight, unit);
        if (!kg) {
          toast.error("Enter a valid weight.");
          return;
        }
        setSubmitting(true);
        try {
          await onSubmit(kg);
          setWeight("");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="min-w-[12rem] flex-1">
        <label className="mb-1 block text-xs font-medium">
          Add weight ({unit})
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          placeholder={unit === "lb" ? "e.g. 31.3" : "e.g. 14.2"}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={disabled}>
        {disabled ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="mr-1.5 h-3.5 w-3.5" />
        )}
        Save weight
      </Button>
    </form>
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
