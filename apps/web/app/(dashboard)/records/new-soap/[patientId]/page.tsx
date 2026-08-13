"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, Paperclip, Plus, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadFileToApi } from "@/lib/upload";
import {
  LabTestForm,
  PrescriptionForm,
  SupplyForm,
  UnitToggle,
  VaccinationForm,
  toastStock,
} from "@/components/patients/patient-clinical-add";
import { toKgString, useWeightUnit } from "@/lib/weight-units";
import {
  BCS_OPTIONS,
  FAS_OPTIONS,
  HYDRATION_OPTIONS,
  MENTATION_OPTIONS,
  MM_OPTIONS,
  PE_SYSTEMS,
  composeObjective,
  composeSubjective,
  emptyPeFindings,
  inferExamStatus,
  soapFormFromNote,
  type FindingStatus,
  type PeFinding,
  type PeSystemKey,
  type TempUnit,
} from "@/lib/soap-form";
import { cn } from "@/lib/utils";

function toFahrenheit(value: string, unit: TempUnit): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  const f = unit === "C" ? n * (9 / 5) + 32 : n;
  return f.toFixed(2);
}

export default function NewSoapNotePage() {
  const params = useParams<{ patientId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const noteId = searchParams.get("noteId");
  const [hydratedNoteId, setHydratedNoteId] = useState<string | null>(null);

  const [reasonForVisit, setReasonForVisit] = useState("");
  const [history, setHistory] = useState("");

  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useWeightUnit();
  const [temperature, setTemperature] = useState("");
  const [tempUnit, setTempUnit] = useState<TempUnit>("F");
  const [heartRate, setHeartRate] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [crt, setCrt] = useState("");
  const [mucousMembrane, setMucousMembrane] = useState("");
  const [hydration, setHydration] = useState("");
  const [bodyCondition, setBodyCondition] = useState("");
  const [mentation, setMentation] = useState("");
  const [pain, setPain] = useState("");
  const [fas, setFas] = useState("");
  const [peFindings, setPeFindings] = useState(emptyPeFindings);

  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [planForm, setPlanForm] = useState<
    "vaccine" | "medication" | "item" | "lab" | null
  >(null);
  const [includeInPlan, setIncludeInPlan] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const crtValue = Number(crt.trim());
  const crtProlonged =
    crt.trim() !== "" && Number.isFinite(crtValue) && crtValue >= 3;

  const { data: patient, isLoading: patientLoading } =
    trpc.patients.getById.useQuery(
      { id: params.patientId },
      { enabled: !!params.patientId }
    );

  const existingNoteQuery = trpc.records.getSoapNote.useQuery(
    { id: noteId! },
    { enabled: !!noteId }
  );

  const createNote = trpc.records.createSoapNote.useMutation();
  const updateNote = trpc.records.updateSoapNote.useMutation();
  const addWeight = trpc.patients.addWeight.useMutation();
  const createVitals = trpc.compliance.createExamVitals.useMutation();
  const createVaccination = trpc.records.createVaccination.useMutation();
  const createPrescription = trpc.records.createPrescription.useMutation();
  const recordUsage = trpc.inventory.recordUsage.useMutation();
  const createLabResult = trpc.records.createLabResult.useMutation();

  useEffect(() => {
    if (!noteId || !existingNoteQuery.data) return;
    if (hydratedNoteId === existingNoteQuery.data.id) return;

    const note = existingNoteQuery.data;
    if (note.patientId !== params.patientId) {
      toast.error("This SOAP note belongs to another patient");
      router.replace(`/patients/${params.patientId}`);
      return;
    }
    if (note.finalizedAt) {
      toast.error("This note is finalized and can no longer be edited");
      router.replace(`/patients/${params.patientId}`);
      return;
    }

    const draft = soapFormFromNote(note, weightUnit);
    setReasonForVisit(draft.reasonForVisit);
    setHistory(draft.history);
    setWeight(draft.weight);
    setWeightUnit(draft.weightUnit);
    setTemperature(draft.temperature);
    setTempUnit(draft.tempUnit);
    setHeartRate(draft.heartRate);
    setRespiratoryRate(draft.respiratoryRate);
    setCrt(draft.crt);
    setMucousMembrane(draft.mucousMembrane);
    setHydration(draft.hydration);
    setBodyCondition(draft.bodyCondition);
    setMentation(draft.mentation);
    setPain(draft.pain);
    setFas(draft.fas);
    setPeFindings(draft.peFindings);
    setAssessment(draft.assessment);
    setPlan(draft.plan);
    setHydratedNoteId(note.id);
  }, [
    noteId,
    existingNoteQuery.data,
    hydratedNoteId,
    params.patientId,
    router,
    setWeightUnit,
    weightUnit,
  ]);

  function appendPlanLine(line: string) {
    setPlan((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
  }

  function togglePlanForm(kind: "vaccine" | "medication" | "item" | "lab") {
    if (planForm === kind) {
      setPlanForm(null);
      return;
    }
    setPlanForm(kind);
    setIncludeInPlan(kind !== "item");
  }

  function updatePeFinding(
    key: PeSystemKey,
    patch: Partial<PeFinding>
  ) {
    setPeFindings((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function handleSave() {
    if (!params.patientId) return;

    const subjective = composeSubjective({
      reasonForVisit,
      history,
    });
    const objective = composeObjective({
      weight,
      weightUnit,
      temperature,
      tempUnit,
      heartRate,
      respiratoryRate,
      crt,
      crtProlonged,
      mucousMembrane,
      hydration,
      bodyCondition,
      mentation,
      pain,
      fas,
      peFindings,
    });
    const planText = plan.trim() || undefined;
    const formDraft = {
      reasonForVisit,
      history,
      weight,
      weightUnit,
      temperature,
      tempUnit,
      heartRate,
      respiratoryRate,
      crt,
      mucousMembrane,
      hydration,
      bodyCondition,
      mentation,
      pain,
      fas,
      peFindings,
      assessment,
      plan,
    };

    try {
      const note = noteId
        ? await updateNote.mutateAsync({
            id: noteId,
            subjective: subjective ?? "",
            objective: objective ?? "",
            assessment: assessment.trim(),
            plan: planText ?? "",
            reasonForVisit: reasonForVisit.trim(),
            formDraft,
            clientUpdatedAt: existingNoteQuery.data?.updatedAt
              ? new Date(existingNoteQuery.data.updatedAt)
              : undefined,
          })
        : await createNote.mutateAsync({
            patientId: params.patientId,
            subjective,
            objective,
            assessment: assessment.trim() || undefined,
            plan: planText,
            reasonForVisit: reasonForVisit.trim() || undefined,
            formDraft,
          });

      const weightKg = toKgString(weight, weightUnit);
      const temperatureF = toFahrenheit(temperature, tempUnit);
      const examStatus = inferExamStatus(peFindings);
      const hasVitals =
        Boolean(weightKg) ||
        Boolean(temperatureF) ||
        Boolean(heartRate.trim()) ||
        Boolean(respiratoryRate.trim()) ||
        Boolean(crt.trim()) ||
        Boolean(objective);

      if (hasVitals) {
        try {
          await createVitals.mutateAsync({
            patientId: params.patientId,
            soapNoteId: note.id,
            weightKg: weightKg || undefined,
            temperatureF: temperatureF || undefined,
            heartRate: heartRate.trim() ? Number(heartRate) : undefined,
            respiratoryRate: respiratoryRate.trim()
              ? Number(respiratoryRate)
              : undefined,
            examStatus,
            examNotes: objective,
          });
        } catch (vitalsErr) {
          toast.error(
            vitalsErr instanceof Error
              ? `Vitals not saved: ${vitalsErr.message}`
              : "Vitals not saved"
          );
        }
      }

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

      const previousWeightKg = existingNoteQuery.data?.vitalsWeightKg
        ? Number(existingNoteQuery.data.vitalsWeightKg).toFixed(3)
        : null;
      if (weightKg && weightKg !== previousWeightKg) {
        try {
          await addWeight.mutateAsync({
            patientId: params.patientId,
            weightKg,
          });
          utils.patients.getById.invalidate({ id: params.patientId });
        } catch (weightErr) {
          toast.error(
            weightErr instanceof Error
              ? `Weight not saved: ${weightErr.message}`
              : "Weight not saved"
          );
        }
      }

      toast.success(noteId ? "SOAP note updated" : "SOAP note created");
      utils.records.listSoapNotes.invalidate({ patientId: params.patientId });
      utils.records.listProblems.invalidate({ patientId: params.patientId });
      router.push(`/patients/${params.patientId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save note");
    }
  }

  function handleAttachmentSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setPendingAttachments((prev) => [...prev, ...selected]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  const saving =
    createNote.isPending || updateNote.isPending || addWeight.isPending;

  if (noteId && existingNoteQuery.isError) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {existingNoteQuery.error.message || "SOAP note not found"}
      </div>
    );
  }

  if (
    patientLoading ||
    (noteId && (existingNoteQuery.isLoading || hydratedNoteId !== noteId))
  ) {
    return (
      <div className="py-12 text-center text-muted-foreground">Loading...</div>
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
        <h2 className="font-heading text-xl font-semibold">
          {noteId ? "Edit SOAP Note" : "New SOAP Note"}
        </h2>
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
        <SoapSection
          letter="S"
          title="Subjective"
          hint="Reason for visit, history, concerns, and the owner's observations."
        >
          <FormField id="reason" label="Reason for visit">
            <Input
              id="reason"
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              placeholder="Chief complaint or visit reason"
            />
          </FormField>
          <FormField
            id="history"
            label="History, concerns, and owner's observations"
          >
            <TextArea
              id="history"
              rows={6}
              value={history}
              onChange={setHistory}
              placeholder="Medical history, current medications, owner concerns, and what they have noticed at home (appetite, energy, behavior, elimination)"
            />
          </FormField>
        </SoapSection>

        <SoapSection
          letter="O"
          title="Objective"
          hint="Vitals and physical exam findings. Weight is also saved to the patient weight history."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="weight-input" label="Weight">
              <div className="flex items-center gap-2">
                <Input
                  id="weight-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={weightUnit === "lb" ? "Weight (lb)" : "Weight (kg)"}
                />
                <UnitToggle unit={weightUnit} onChange={setWeightUnit} />
              </div>
            </FormField>
            <FormField id="temperature" label="Temperature">
              <div className="flex items-center gap-2">
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder={tempUnit === "C" ? "Temp (°C)" : "Temp (°F)"}
                />
                <SegmentedToggle
                  ariaLabel="Temperature unit"
                  value={tempUnit}
                  options={["F", "C"]}
                  labels={{ F: "°F", C: "°C" }}
                  onChange={setTempUnit}
                />
              </div>
            </FormField>
            <FormField id="heart-rate" label="Heart rate (bpm)">
              <Input
                id="heart-rate"
                type="number"
                min="0"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="bpm"
              />
            </FormField>
            <FormField id="resp-rate" label="Respiration rate (bpm)">
              <Input
                id="resp-rate"
                type="number"
                min="0"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value)}
                placeholder="bpm"
              />
            </FormField>
            <FormField id="crt" label="Capillary refill time (sec)">
              <Input
                id="crt"
                type="number"
                step="0.5"
                min="0"
                value={crt}
                onChange={(e) => setCrt(e.target.value)}
                placeholder="seconds"
                aria-invalid={crtProlonged}
                className={cn(crtProlonged && "border-destructive")}
              />
              {crtProlonged && (
                <p
                  role="alert"
                  className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  CRT is 3 seconds or more
                </p>
              )}
            </FormField>
            <SelectField
              id="mm"
              label="Mucous membranes"
              value={mucousMembrane}
              onChange={setMucousMembrane}
              options={MM_OPTIONS}
              placeholder="Select mucous membranes"
            />
            <SelectField
              id="hydration"
              label="Hydration"
              value={hydration}
              onChange={setHydration}
              options={HYDRATION_OPTIONS}
              placeholder="Select hydration"
            />
            <SelectField
              id="bcs"
              label="Body condition"
              value={bodyCondition}
              onChange={setBodyCondition}
              options={BCS_OPTIONS}
              placeholder="Select BCS"
            />
            <SelectField
              id="mentation"
              label="Mentation"
              value={mentation}
              onChange={setMentation}
              options={MENTATION_OPTIONS}
              placeholder="Select mentation"
            />
            <SelectField
              id="pain"
              label="Pain"
              value={pain}
              onChange={setPain}
              options={Array.from({ length: 11 }, (_, i) => String(i))}
              optionLabels={Object.fromEntries(
                Array.from({ length: 11 }, (_, i) => [
                  String(i),
                  i === 0
                    ? "0 — None"
                    : i === 10
                      ? "10 — Severe"
                      : String(i),
                ])
              )}
              placeholder="Select pain score (0–10)"
            />
            <SelectField
              id="fas"
              label="Fear / anxiety / stress"
              value={fas}
              onChange={setFas}
              options={FAS_OPTIONS}
              placeholder="Select FAS score"
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">Physical exam</p>
            <div className="space-y-3">
              {PE_SYSTEMS.map((system) => {
                const finding = peFindings[system.key];
                return (
                  <div
                    key={system.key}
                    className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start"
                  >
                    <div>
                      <p className="mb-1.5 text-sm font-medium">{system.label}</p>
                      <FindingStatusToggle
                        value={finding.status}
                        onChange={(status) =>
                          updatePeFinding(system.key, { status })
                        }
                      />
                    </div>
                    <TextArea
                      id={`pe-${system.key}`}
                      rows={2}
                      value={finding.notes}
                      onChange={(notes) =>
                        updatePeFinding(system.key, { notes })
                      }
                      placeholder="Findings"
                      className="min-h-[2.75rem]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </SoapSection>

        <SoapSection
          letter="A"
          title="Assessment"
          hint="One diagnosis per line for the problem list. Wellness notes such as Appears healthy or NSF stay on the SOAP only."
        >
          <FormField id="assessment" label="Diagnosis or differentials">
            <TextArea
              id="assessment"
              rows={5}
              value={assessment}
              onChange={setAssessment}
              placeholder={"Appears healthy\nOtitis externa"}
            />
          </FormField>
        </SoapSection>

        <SoapSection
          letter="P"
          title="Plan"
          hint="Actions taken or prescribed, follow-up recommendations, and next steps for the patient."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={planForm === "vaccine" ? "default" : "outline"}
              onClick={() => togglePlanForm("vaccine")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Vaccine
            </Button>
            <Button
              type="button"
              size="sm"
              variant={planForm === "medication" ? "default" : "outline"}
              onClick={() => togglePlanForm("medication")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Medication
            </Button>
            <Button
              type="button"
              size="sm"
              variant={planForm === "item" ? "default" : "outline"}
              onClick={() => togglePlanForm("item")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Use item
            </Button>
            <Button
              type="button"
              size="sm"
              variant={planForm === "lab" ? "default" : "outline"}
              onClick={() => togglePlanForm("lab")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Lab test
            </Button>
          </div>
          {planForm && (
            <IncludeInPlanToggle
              value={includeInPlan}
              onChange={setIncludeInPlan}
            />
          )}
          {planForm === "vaccine" && params.patientId && (
            <VaccinationForm
              onSubmit={async (data) => {
                try {
                  const result = await createVaccination.mutateAsync({
                    patientId: params.patientId,
                    ...data,
                  });
                  toast.success("Vaccination recorded");
                  toastStock(result);
                  if (includeInPlan) {
                    const due = data.nextDueDate
                      ? `; next due ${data.nextDueDate}`
                      : "";
                    const lot = data.lotNumber ? ` (lot ${data.lotNumber})` : "";
                    appendPlanLine(`Vaccine: ${data.vaccineName}${lot}${due}`);
                  }
                  setPlanForm(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to save vaccine"
                  );
                }
              }}
              loading={createVaccination.isPending}
            />
          )}
          {planForm === "medication" && params.patientId && (
            <PrescriptionForm
              onSubmit={async (data) => {
                try {
                  const result = await createPrescription.mutateAsync({
                    patientId: params.patientId,
                    ...data,
                  });
                  toast.success("Prescription added");
                  toastStock(result);
                  if (includeInPlan) {
                    const extra = data.instructions
                      ? ` — ${data.instructions}`
                      : "";
                    appendPlanLine(
                      `Medication: ${data.medicationName} ${data.dosage} ${data.frequency}${extra}`
                    );
                  }
                  setPlanForm(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Failed to save medication"
                  );
                }
              }}
              loading={createPrescription.isPending}
            />
          )}
          {planForm === "item" && params.patientId && (
            <SupplyForm
              onSubmit={async (data) => {
                try {
                  const result = await recordUsage.mutateAsync({
                    patientId: params.patientId,
                    productId: data.productId,
                    quantity: data.quantity,
                    sourceType: "supply",
                    note: data.stockNote,
                  });
                  toast.success("Item use recorded");
                  toastStock(result);
                  if (includeInPlan) {
                    const units = data.units ? ` ${data.units}` : "";
                    appendPlanLine(
                      `Used: ${data.quantity}${units} ${data.productName}`
                    );
                  }
                  setPlanForm(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to record item"
                  );
                }
              }}
              loading={recordUsage.isPending}
            />
          )}
          {planForm === "lab" && params.patientId && (
            <LabTestForm
              onSubmit={async (data) => {
                try {
                  await createLabResult.mutateAsync({
                    patientId: params.patientId,
                    testName: data.testName,
                    notes: data.notes,
                    resultDate: data.resultDate,
                    status: "pending",
                  });
                  toast.success("Lab test ordered");
                  utils.records.listLabResults.invalidate({
                    patientId: params.patientId,
                  });
                  if (includeInPlan) {
                    appendPlanLine(`Lab: ${data.testName}`);
                  }
                  setPlanForm(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Failed to order lab test"
                  );
                }
              }}
              loading={createLabResult.isPending}
            />
          )}
          <FormField
            id="plan"
            label="Actions, follow-up, and next steps"
          >
            <TextArea
              id="plan"
              rows={6}
              value={plan}
              onChange={setPlan}
              placeholder="Treatments given, medications prescribed, recheck timing, monitoring at home, referrals, or other next steps"
            />
          </FormField>
        </SoapSection>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
          <div>
            <h3 className="font-heading text-base font-semibold">Attachments</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Attach exam photos, wound photos, or PDFs to this note.
            </p>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleAttachmentSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={handleAttachmentSelect}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="mr-2 h-4 w-4" />
              Take photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Add files
            </Button>
          </div>
          {pendingAttachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {pendingAttachments.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                >
                  <span className="max-w-[8rem] truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label="Remove file"
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
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="min-h-11"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Note"}
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

function SoapSection({
  letter,
  title,
  hint,
  children,
}: {
  letter: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {letter}
          </span>
          <h3 className="font-heading text-base font-semibold">{title}</h3>
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextArea({
  id,
  rows,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "min-h-[5rem] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    />
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  optionLabels,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
  placeholder: string;
}) {
  return (
    <FormField id={id} label={label}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function IncludeInPlanToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {value
          ? "This will also be added to the plan text."
          : "Inventory / invoice only — not added to the plan."}
      </p>
      <SegmentedToggle
        ariaLabel="Include in plan"
        value={value ? "plan" : "inventory"}
        options={["plan", "inventory"]}
        labels={{ plan: "Include in plan", inventory: "Inventory only" }}
        onChange={(next) => onChange(next === "plan")}
      />
    </div>
  );
}

function SegmentedToggle<T extends string>({
  value,
  options,
  labels,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-input bg-background text-xs font-medium"
    >
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={cn(
              "px-3 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {labels?.[option] ?? option}
          </button>
        );
      })}
    </div>
  );
}

function FindingStatusToggle({
  value,
  onChange,
}: {
  value: FindingStatus | "";
  onChange: (next: FindingStatus) => void;
}) {
  const options: Array<{ id: FindingStatus; label: string }> = [
    { id: "wnl", label: "WNL" },
    { id: "abnormal", label: "Abn" },
    { id: "not_examined", label: "NE" },
  ];

  return (
    <div
      role="group"
      aria-label="Exam finding status"
      className="inline-flex h-8 overflow-hidden rounded-md border border-input bg-background text-xs font-medium"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={cn(
              "px-2.5 transition-colors",
              active
                ? option.id === "abnormal"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
