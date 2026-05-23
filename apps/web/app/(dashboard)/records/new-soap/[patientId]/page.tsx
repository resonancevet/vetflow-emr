"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadFileToApi } from "@/lib/upload";

export default function NewSoapNotePage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const { data: patient, isLoading: patientLoading } =
    trpc.patients.getById.useQuery(
      { id: params.patientId },
      { enabled: !!params.patientId }
    );

  const createNote = trpc.records.createSoapNote.useMutation();

  async function handleSave() {
    if (!params.patientId) return;

    try {
      const note = await createNote.mutateAsync({
        patientId: params.patientId,
        subjective: subjective || undefined,
        objective: objective || undefined,
        assessment: assessment || undefined,
        plan: plan || undefined,
      });

      if (pendingPhotos.length > 0) {
        await Promise.all(
          pendingPhotos.map((file) =>
            uploadFileToApi(file, {
              category: "soap-attachments",
              entityType: "soap_note",
              entityId: note.id,
            })
          )
        );
      }

      toast.success("SOAP note created");
      router.push(`/records?patient=${params.patientId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setPendingPhotos((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (patientLoading) {
    return (
      <div className="text-center text-muted-foreground py-12">Loading...</div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/records")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Records
      </Button>

      <div>
        <h2 className="font-heading text-xl font-semibold">New SOAP Note</h2>
        {patient && (
          <p className="text-sm text-muted-foreground">
            Patient: {patient.name}
            {patient.species
              ? ` — ${patient.species.charAt(0).toUpperCase()}${patient.species.slice(1)}`
              : ""}
            {patient.breed ? ` (${patient.breed})` : ""}
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-6">
          {(
            [
              ["subjective", "Subjective", "Owner complaint, history, symptoms", subjective, setSubjective],
              ["objective", "Objective", "Exam findings, vitals, test results", objective, setObjective],
              ["assessment", "Assessment", "Diagnosis or differentials", assessment, setAssessment],
              ["plan", "Plan", "Treatment, medications, follow-up", plan, setPlan],
            ] as const
          ).map(([id, label, hint, value, setter]) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium mb-1.5">
                {label}
              </label>
              <p className="text-xs text-muted-foreground mb-2">{hint}</p>
              <textarea
                id={id}
                rows={4}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[5rem]"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium mb-1.5">Photos</label>
            <p className="text-xs text-muted-foreground mb-2">
              Attach exam or wound photos to this note
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Add photos
            </Button>
            {pendingPhotos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {pendingPhotos.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                  >
                    <span className="max-w-[8rem] truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() =>
                        setPendingPhotos((prev) =>
                          prev.filter((_, idx) => idx !== i)
                        )
                      }
                      className="rounded p-0.5 hover:bg-accent"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={createNote.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {createNote.isPending ? "Saving..." : "Save Note"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/records")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
