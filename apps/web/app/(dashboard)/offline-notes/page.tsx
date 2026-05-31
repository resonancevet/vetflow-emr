"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  NotebookPen,
  Paperclip,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  OFFLINE_FIELD_NOTES_CHANGED,
  createOfflineFieldNote,
  deleteOfflineFieldNote,
  listOfflineFieldNotes,
  markOfflineFieldNoteAttached,
  type OfflineFieldNote,
  updateOfflineFieldNote,
} from "@/lib/offline/field-notes";
import { useNetworkStatus } from "@/lib/offline/use-network-status";

type PatientSearchResult = {
  id: string;
  name: string;
  species: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function patientLabel(patient?: PatientSearchResult | null) {
  if (!patient) return "";
  const owner = [patient.clientFirstName, patient.clientLastName]
    .filter(Boolean)
    .join(" ");
  return owner ? `${patient.name} (${owner})` : patient.name;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          "Local note storage is taking longer than expected. Try reloading or retrying."
        )
      );
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function noteSubjective(note: OfflineFieldNote) {
  // Backward compatibility: older notes stored everything in `body`.
  if (note.subjective !== undefined) return note.subjective;
  return note.body ?? "";
}

function attachSearchQuery(note: OfflineFieldNote) {
  const parts = [note.title, note.ownerLastName].filter(
    (part) => part && part.trim().length > 0
  );
  return parts.join(" ").trim();
}

export default function OfflineNotesPage() {
  const { online } = useNetworkStatus();
  const [notes, setNotes] = useState<OfflineFieldNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [patientName, setPatientName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] =
    useState<PatientSearchResult | null>(null);

  const utils = trpc.useUtils();

  const createSoapNote = trpc.records.createSoapNote.useMutation({
    onSuccess: () => {
      utils.records.listSoapNotes.invalidate().catch(() => {
        // No patient chart open; nothing to invalidate.
      });
    },
  });

  const { data: patientResults } = trpc.patients.search.useQuery(
    { query: patientQuery },
    {
      enabled: patientQuery.trim().length >= 2,
    }
  );

  const selectedAttachNote = useMemo(
    () => notes.find((note) => note.id === attachingId) ?? null,
    [attachingId, notes]
  );

  const loadNotes = async () => {
    setLoadingNotes(true);
    setLoadError(null);
    try {
      const rows = await withTimeout(listOfflineFieldNotes(), 7000);
      setNotes(rows);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load offline notes.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    loadNotes().catch(() => {
      // already toasted in loadNotes
    });

    const handle = () => {
      loadNotes().catch(() => {
        // already toasted in loadNotes
      });
    };

    window.addEventListener(OFFLINE_FIELD_NOTES_CHANGED, handle);
    return () => window.removeEventListener(OFFLINE_FIELD_NOTES_CHANGED, handle);
  }, []);

  const resetEditor = () => {
    setPatientName("");
    setOwnerLastName("");
    setVisitAt("");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setEditingId(null);
  };

  const saveNote = async () => {
    const hasContent = [subjective, objective, assessment, plan].some(
      (value) => value.trim().length > 0
    );
    if (!hasContent) {
      toast.error(
        "Add text in subjective, objective, assessment, or plan before saving."
      );
      return;
    }

    try {
      const payload = {
        title: patientName,
        ownerLastName,
        visitAt: visitAt || undefined,
        subjective,
        objective,
        assessment,
        plan,
      };

      if (editingId) {
        await updateOfflineFieldNote(editingId, payload);
        toast.success("Offline note updated.");
      } else {
        await createOfflineFieldNote(payload);
        toast.success("Saved locally to iPad.");
      }
      resetEditor();
      await loadNotes();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Could not save offline note."
      );
    }
  };

  const startEdit = (note: OfflineFieldNote) => {
    setEditingId(note.id);
    setPatientName(note.title);
    setOwnerLastName(note.ownerLastName ?? "");
    setVisitAt(note.visitAt ? note.visitAt.slice(0, 16) : "");
    setSubjective(noteSubjective(note));
    setObjective(note.objective ?? "");
    setAssessment(note.assessment ?? "");
    setPlan(note.plan ?? "");
  };

  const removeNote = async (note: OfflineFieldNote) => {
    const okay = window.confirm("Delete this offline note?");
    if (!okay) return;

    try {
      await deleteOfflineFieldNote(note.id);
      toast.success("Offline note deleted.");
      await loadNotes();
      if (editingId === note.id) resetEditor();
      if (attachingId === note.id) {
        setAttachingId(null);
        setPatientQuery("");
        setSelectedPatient(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not delete offline note.");
    }
  };

  const attachNote = async () => {
    if (!selectedAttachNote || !selectedPatient) {
      toast.error("Select a note and patient first.");
      return;
    }

    try {
      const visitPrefix = selectedAttachNote.visitAt
        ? `Field visit: ${formatDateTime(selectedAttachNote.visitAt)}`
        : "";
      const subjectiveText = noteSubjective(selectedAttachNote).trim();
      const subjectiveCombined = [visitPrefix, subjectiveText]
        .filter(Boolean)
        .join("\n\n");

      const soap = await createSoapNote.mutateAsync({
        patientId: selectedPatient.id,
        subjective: subjectiveCombined,
        objective: selectedAttachNote.objective ?? "",
        assessment: selectedAttachNote.assessment ?? "",
        plan: selectedAttachNote.plan ?? "",
      });

      await markOfflineFieldNoteAttached({
        id: selectedAttachNote.id,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        soapNoteId: soap.id,
      });

      toast.success("Attached to patient as SOAP note.");
      setAttachingId(null);
      setPatientQuery("");
      setSelectedPatient(null);
      await loadNotes();
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to attach note."
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Offline Notes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture SOAP-shaped field notes with no service. Attach them to a
          patient when back online.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Status:{" "}
          <span
            className={online ? "text-emerald-600" : "text-amber-600"}
          >
            {online ? "Online" : "Offline"}
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {editingId ? "Edit local note" : "New local note"}
            </h3>
            {editingId ? (
              <Button variant="ghost" size="sm" onClick={resetEditor}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Patient name
                </label>
                <Input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Bella"
                  className="mt-1 min-h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Owner last name
                </label>
                <Input
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  className="mt-1 min-h-11"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Patient name and owner help you find the right chart when
              attaching online. They are not saved into the SOAP note itself.
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Offline appointment date/time
              </label>
              <Input
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                className="mt-1 min-h-11"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Added at the top of the SOAP subjective when attached.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Subjective
              </label>
              <textarea
                value={subjective}
                onChange={(e) => setSubjective(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="History, owner-reported signs..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Objective
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Exam findings, vitals..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Assessment
              </label>
              <textarea
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Clinical impressions, differentials..."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Plan
              </label>
              <textarea
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Treatments, follow-up, recheck timing..."
              />
            </div>

            <Button onClick={saveNote} className="min-h-11 w-full sm:w-auto">
              <NotebookPen className="mr-2 h-4 w-4" />
              {editingId ? "Update local note" : "Save locally"}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Saved offline notes</h3>

          {loadingNotes ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading local notes...
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">Local notes did not load.</p>
              <p className="mt-1 text-xs">
                {loadError} This can happen on iPad after airplane mode. Your
                notes may still be stored on this iPad.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  loadNotes().catch(() => {
                    // loadNotes already displays the error
                  });
                }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry loading notes
              </Button>
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offline notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => {
                const ownerHint = note.ownerLastName
                  ? ` (${note.ownerLastName})`
                  : "";
                return (
                  <li key={note.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          {note.title}
                          {ownerHint}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated {formatDateTime(note.updatedAt)}
                        </p>
                        {note.visitAt && (
                          <p className="text-xs text-muted-foreground">
                            Visit: {formatDateTime(note.visitAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(note)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeNote(note)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <SoapPreview note={note} />

                    {note.attachedAt ? (
                      <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                        Attached to {note.attachedPatientName ?? "patient"} on{" "}
                        {formatDateTime(note.attachedAt)}
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAttachingId(note.id);
                            setPatientQuery(attachSearchQuery(note));
                            setSelectedPatient(null);
                          }}
                        >
                          <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                          Attach to patient
                        </Button>
                        {!online && (
                          <span className="text-xs text-amber-700 dark:text-amber-400">
                            Browser reports offline. Attach will fail until reconnected.
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {attachingId && selectedAttachNote && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Attach note to patient</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Creates a SOAP note from this offline entry. Visit time is added to
            the top of the subjective; the rest of the fields map directly.
          </p>

          <div className="mt-3 space-y-3">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={patientQuery}
                onChange={(e) => {
                  setPatientQuery(e.target.value);
                  setSelectedPatient(null);
                }}
                placeholder="Search by patient name and owner..."
                className="pl-9 min-h-11"
              />
            </div>

            {!selectedPatient &&
              patientResults &&
              patientResults.length > 0 && (
                <ul className="max-h-52 overflow-y-auto rounded-md border border-border">
                  {patientResults.map((patient) => (
                    <li key={patient.id}>
                      <button
                        type="button"
                        className="w-full border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/40"
                        onClick={() => setSelectedPatient(patient)}
                      >
                        {patientLabel(patient)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

            {selectedPatient ? (
              <p className="text-sm">
                Selected:{" "}
                <span className="font-medium">
                  {patientLabel(selectedPatient)}
                </span>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={attachNote}
                disabled={!selectedPatient || createSoapNote.isPending}
              >
                {createSoapNote.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create SOAP from note
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAttachingId(null);
                  setPatientQuery("");
                  setSelectedPatient(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SoapPreview({ note }: { note: OfflineFieldNote }) {
  const subjectiveText = noteSubjective(note);
  const sections: { label: string; value: string }[] = [
    { label: "Subjective", value: subjectiveText },
    { label: "Objective", value: note.objective ?? "" },
    { label: "Assessment", value: note.assessment ?? "" },
    { label: "Plan", value: note.plan ?? "" },
  ].filter((section) => section.value.trim().length > 0);

  if (sections.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        (Empty note)
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {section.label}
          </p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {section.value}
          </p>
        </div>
      ))}
    </div>
  );
}
