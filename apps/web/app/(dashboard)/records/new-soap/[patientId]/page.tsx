"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadFileToApi } from "@/lib/upload";
import { UnitToggle } from "@/components/patients/patient-clinical-add";
import { toKgString, useWeightUnit } from "@/lib/weight-units";

export default function NewSoapNotePage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useWeightUnit();
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const { data: patient, isLoading: patientLoading } =
    trpc.patients.getById.useQuery(
      { id: params.patientId },
      { enabled: !!params.patientId }
    );

  const createNote = trpc.records.createSoapNote.useMutation();
  const addWeight = trpc.patients.addWeight.useMutation();

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

      if (pendingAttachments.length > 0) {
        await Promise.all(
          pendingAttachments.map((file) =>
            uploadFileToApi(file, {
              category: "soap-attachments",
              entityType: "soap_note",
              entityId: note.id,
            })
          )
        );
      }

      // Save weight as a separate vital so the Weight tab stays accurate.
      const weightKg = toKgString(weight, weightUnit);
      if (weightKg) {
        try {
          await addWeight.mutateAsync({
            patientId: params.patientId,
            weightKg,
          });
          utils.patients.getById.invalidate({ id: params.patientId });
        } catch (weightErr) {
          // Don't fail the whole save — the SOAP note already exists.
          toast.error(
            weightErr instanceof Error
              ? `Weight not saved: ${weightErr.message}`
              : "Weight not saved"
          );
        }
      }

      toast.success("SOAP note created");
      router.push(`/patients/${params.patientId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  function handleAttachmentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setPendingAttachments((prev) => [...prev, ...selected]);
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
        onClick={() => router.push(`/patients/${params.patientId}`)}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Patient
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
          <div>
            <label
              htmlFor="weight-input"
              className="block text-sm font-medium mb-1.5"
            >
              Weight ({weightUnit})
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Optional. Saved to this patient&apos;s weight history in
              kilograms.
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="weight-input"
                type="number"
                step="0.01"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={weightUnit === "lb" ? "e.g. 31.3" : "e.g. 14.2"}
                className="max-w-[12rem]"
              />
              <UnitToggle unit={weightUnit} onChange={setWeightUnit} />
            </div>
          </div>

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
            <label className="block text-sm font-medium mb-1.5">
              Attachments
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Attach exam photos, wound photos, or PDFs to this note.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleAttachmentSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Add photos/files
            </Button>
            {pendingAttachments.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {pendingAttachments.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                  >
                    <span className="max-w-[8rem] truncate">{file.name}</span>
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() =>
                        setPendingAttachments((prev) =>
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
          <Button
            onClick={handleSave}
            disabled={createNote.isPending || addWeight.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createNote.isPending || addWeight.isPending
              ? "Saving..."
              : "Save Note"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/patients/${params.patientId}`)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
