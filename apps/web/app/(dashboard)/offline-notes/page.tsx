"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, NotebookPen, Paperclip, Search, Trash2 } from "lucide-react";
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

export default function OfflineNotesPage() {
  const { online } = useNetworkStatus();
  const [notes, setNotes] = useState<OfflineFieldNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);

  const utils = trpc.useUtils();

  const createSoapNote = trpc.records.createSoapNote.useMutation({
    onSuccess: () => {
      utils.records.listSoapNotes.invalidate().catch(() => {
        // no-op: this page can be used without an open patient chart
      });
    },
  });

  const { data: patientResults } = trpc.patients.search.useQuery(
    { query: patientQuery },
    {
      enabled: online && patientQuery.trim().length >= 2,
    }
  );

  const selectedAttachNote = useMemo(
    () => notes.find((note) => note.id === attachingId) ?? null,
    [attachingId, notes]
  );

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const rows = await listOfflineFieldNotes();
      setNotes(rows);
    } catch (error) {
      console.error(error);
      toast.error("Unable to load offline notes.");
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
    setTitle("");
    setBody("");
    setVisitAt("");
    setEditingId(null);
  };

  const saveNote = async () => {
    if (!body.trim()) {
      toast.error("Add note text before saving.");
      return;
    }

    try {
      if (editingId) {
        await updateOfflineFieldNote(editingId, {
          title,
          body: body.trim(),
          visitAt: visitAt || undefined,
        });
        toast.success("Offline note updated.");
      } else {
        await createOfflineFieldNote({
          title,
          body: body.trim(),
          visitAt: visitAt || undefined,
        });
        toast.success("Saved locally to iPad.");
      }
      resetEditor();
      await loadNotes();
    } catch (error) {
      console.error(error);
      toast.error("Could not save offline note.");
    }
  };

  const startEdit = (note: OfflineFieldNote) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setVisitAt(note.visitAt ? note.visitAt.slice(0, 16) : "");
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
    if (!online) {
      toast.error("Reconnect before attaching to a patient.");
      return;
    }
    if (!selectedAttachNote || !selectedPatient) {
      toast.error("Select a note and patient first.");
      return;
    }

    try {
      const soap = await createSoapNote.mutateAsync({
        patientId: selectedPatient.id,
        subjective: selectedAttachNote.body,
        objective: "",
        assessment: selectedAttachNote.title || "Offline field note",
        plan: selectedAttachNote.visitAt
          ? `Field visit time: ${formatDateTime(selectedAttachNote.visitAt)}`
          : "",
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
      toast.error(error instanceof Error ? error.message : "Failed to attach note.");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Offline Notes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture field notes with no service, then attach them to patients later.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Status: <span className={online ? "text-emerald-600" : "text-amber-600"}>{online ? "Online" : "Offline"}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingId ? "Edit local note" : "New local note"}</h3>
            {editingId ? (
              <Button variant="ghost" size="sm" onClick={resetEditor}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Visit summary"
                className="mt-1 min-h-11"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Visit time (optional)</label>
              <Input
                type="datetime-local"
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
                className="mt-1 min-h-11"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Type your appointment notes here while offline..."
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
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offline notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{note.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {formatDateTime(note.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(note)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeNote(note)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{note.body}</p>

                  {note.attachedAt ? (
                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                      Attached to {note.attachedPatientName ?? "patient"} on {formatDateTime(note.attachedAt)}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!online}
                        onClick={() => {
                          setAttachingId(note.id);
                          setPatientQuery("");
                          setSelectedPatient(null);
                        }}
                      >
                        <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                        Attach to patient
                      </Button>
                      {!online && (
                        <span className="text-xs text-muted-foreground">Reconnect to attach.</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {attachingId && selectedAttachNote && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Attach note to patient</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This will create a SOAP note with your offline note text in the subjective section.
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
                placeholder="Search patients by name or breed..."
                className="pl-9 min-h-11"
                disabled={!online}
              />
            </div>

            {!selectedPatient && patientResults && patientResults.length > 0 && (
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
                Selected: <span className="font-medium">{patientLabel(selectedPatient)}</span>
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={attachNote} disabled={!selectedPatient || createSoapNote.isPending}>
                {createSoapNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
