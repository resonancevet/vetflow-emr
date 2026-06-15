"use client";

import { useRef, useState } from "react";
import {
  Activity,
  ClipboardCheck,
  FileDown,
  FileText,
  HeartPulse,
  Pill,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generateDischargeInstructions } from "@/lib/pdf";
import { uploadFileToApi } from "@/lib/upload";

type PatientInfo = {
  id: string;
  name: string;
  species: string | null;
  microchipNumber?: string | null;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
};

const ROUTE_OPTIONS = [
  { value: "oral", label: "Oral" },
  { value: "topical", label: "Topical" },
  { value: "subcutaneous", label: "Subcutaneous" },
  { value: "intramuscular", label: "Intramuscular" },
  { value: "intravenous", label: "IV" },
  { value: "other", label: "Other" },
] as const;

const EXAM_STATUS_OPTIONS = [
  { value: "wnl", label: "WNL" },
  { value: "abnormal", label: "Abnormal" },
  { value: "not_examined", label: "Not examined" },
] as const;

const SPECIALIZED_DOC_CATEGORIES = [
  { value: "cage-chart", label: "Cage chart" },
  { value: "dental-chart", label: "Dental chart" },
  { value: "surgical-report", label: "Surgical report" },
  { value: "anesthesia-monitor", label: "Anesthesia monitor" },
] as const;

const emptyVitalsForm = {
  weightKg: "",
  temperatureF: "",
  heartRate: "",
  respiratoryRate: "",
  examStatus: "wnl" as const,
  examNotes: "",
};
const emptyConsentForm = {
  recommendation: "",
  decision: "consented" as "consented" | "declined",
  risks: "",
  benefits: "",
  estimatedCost: "",
  notes: "",
};
const emptyTreatmentForm = {
  medicationName: "",
  dosage: "",
  route: "oral" as (typeof ROUTE_OPTIONS)[number]["value"],
  responseToTreatment: "",
  notes: "",
};
const emptyCustodyForm = {
  custodyStart: "",
  custodyEnd: "",
  reason: "",
  notes: "",
};
const emptyAnesthesiaForm = {
  protocol: "",
  vitalSignsLog: "",
  complications: "",
  notes: "",
};
const emptyDischargeForm = {
  visitDate: new Date().toISOString().slice(0, 10),
  diagnosis: "",
  doctorName: "",
  instructions: "",
  followUpDate: "",
  emergencyNotes:
    "Seek emergency care for difficulty breathing, seizures, collapse, or inability to urinate.",
};

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

export function PatientComplianceSection({
  patient,
  canManage,
}: {
  patient: PatientInfo;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const clientName =
    [patient.clientFirstName, patient.clientLastName].filter(Boolean).join(" ") ||
    "Unknown owner";

  const vitalsQuery = trpc.compliance.listExamVitals.useQuery({
    patientId: patient.id,
  });
  const consentsQuery = trpc.compliance.listConsents.useQuery({
    patientId: patient.id,
  });
  const dischargeQuery = trpc.compliance.listDischargeInstructions.useQuery({
    patientId: patient.id,
  });
  const treatmentsQuery = trpc.compliance.listTreatmentAdministrations.useQuery({
    patientId: patient.id,
  });
  const custodyQuery = trpc.compliance.listCustody.useQuery({
    patientId: patient.id,
  });
  const anesthesiaQuery = trpc.compliance.listAnesthesiaRecords.useQuery({
    patientId: patient.id,
  });
  const filesQuery = trpc.records.listFilesForEntity.useQuery({
    entityType: "patient",
    entityId: patient.id,
  });

  const createVitals = trpc.compliance.createExamVitals.useMutation({
    onSuccess: () => {
      toast.success("Vitals recorded");
      utils.compliance.listExamVitals.invalidate({ patientId: patient.id });
      setVitalsForm(emptyVitalsForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const createConsent = trpc.compliance.createConsent.useMutation({
    onSuccess: () => {
      toast.success("Consent documented");
      utils.compliance.listConsents.invalidate({ patientId: patient.id });
      setConsentForm(emptyConsentForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const createDischarge = trpc.compliance.createDischargeInstructions.useMutation();
  const attachDischargePdf = trpc.compliance.attachDischargePdf.useMutation();
  const createTreatment = trpc.compliance.createTreatmentAdministration.useMutation({
    onSuccess: () => {
      toast.success("Treatment logged");
      utils.compliance.listTreatmentAdministrations.invalidate({
        patientId: patient.id,
      });
      setTreatmentForm(emptyTreatmentForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const createCustody = trpc.compliance.createCustody.useMutation({
    onSuccess: () => {
      toast.success("Custody period recorded");
      utils.compliance.listCustody.invalidate({ patientId: patient.id });
      setCustodyForm(emptyCustodyForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const createAnesthesia = trpc.compliance.createAnesthesiaRecord.useMutation({
    onSuccess: () => {
      toast.success("Anesthesia record saved");
      utils.compliance.listAnesthesiaRecords.invalidate({ patientId: patient.id });
      setAnesthesiaForm(emptyAnesthesiaForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const [vitalsForm, setVitalsForm] = useState(emptyVitalsForm);
  const [consentForm, setConsentForm] = useState(emptyConsentForm);
  const [treatmentForm, setTreatmentForm] = useState(emptyTreatmentForm);
  const [custodyForm, setCustodyForm] = useState(emptyCustodyForm);
  const [anesthesiaForm, setAnesthesiaForm] = useState(emptyAnesthesiaForm);
  const [dischargeForm, setDischargeForm] = useState(emptyDischargeForm);
  const [docCategory, setDocCategory] =
    useState<(typeof SPECIALIZED_DOC_CATEGORIES)[number]["value"]>("cage-chart");
  const docInputRef = useRef<HTMLInputElement>(null);

  const specializedFiles =
    filesQuery.data?.filter((f) =>
      SPECIALIZED_DOC_CATEGORIES.some((c) => c.value === f.category)
    ) ?? [];

  async function handleDischargeSave(downloadPdf: boolean) {
    const instructions = dischargeForm.instructions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (instructions.length === 0) {
      toast.error("Add at least one care instruction");
      return;
    }

    try {
      const record = await createDischarge.mutateAsync({
        patientId: patient.id,
        visitDate: dischargeForm.visitDate,
        diagnosis: dischargeForm.diagnosis || undefined,
        doctorName: dischargeForm.doctorName || undefined,
        instructions,
        followUpDate: dischargeForm.followUpDate || undefined,
        emergencyNotes: dischargeForm.emergencyNotes || undefined,
      });

      const pdfData = {
        practiceName: "",
        patientName: patient.name,
        species: patient.species ?? "unknown",
        microchip: patient.microchipNumber ?? undefined,
        clientName,
        clientAddress: patient.clientAddress ?? undefined,
        clientPhone: patient.clientPhone ?? undefined,
        visitDate: new Date(dischargeForm.visitDate).toLocaleDateString(),
        doctorName: dischargeForm.doctorName || undefined,
        diagnosis: dischargeForm.diagnosis || undefined,
        medications: [] as Array<{
          name: string;
          dosage: string;
          frequency: string;
        }>,
        instructions,
        followUpDate: dischargeForm.followUpDate
          ? new Date(dischargeForm.followUpDate).toLocaleDateString()
          : undefined,
        emergencyNotes: dischargeForm.emergencyNotes || undefined,
      };

      const doc = generateDischargeInstructions(pdfData);
      const blob = doc.output("blob");
      const pdfFile = new File(
        [blob],
        `discharge_${patient.name.replace(/\s+/g, "_")}.pdf`,
        { type: "application/pdf" }
      );

      const upload = await uploadFileToApi(pdfFile, {
        category: "discharge-pdf",
        entityType: "discharge_instructions",
        entityId: record.id,
      });

      if (upload.id) {
        await attachDischargePdf.mutateAsync({
          id: record.id,
          pdfFileId: upload.id,
        });
      }

      utils.compliance.listDischargeInstructions.invalidate({
        patientId: patient.id,
      });
      utils.records.listFilesForEntity.invalidate({
        entityType: "patient",
        entityId: patient.id,
      });

      if (downloadPdf) {
        doc.save(pdfFile.name);
      }

      toast.success("Discharge instructions saved to record");
      setDischargeForm(emptyDischargeForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save discharge");
    }
  }

  function downloadStoredDischarge(
    row: NonNullable<typeof dischargeQuery.data>[number]
  ) {
    const instructions = row.instructions ?? [];
    generateDischargeInstructions({
      practiceName: "",
      patientName: patient.name,
      species: patient.species ?? "unknown",
      microchip: patient.microchipNumber ?? undefined,
      clientName,
      clientAddress: patient.clientAddress ?? undefined,
      clientPhone: patient.clientPhone ?? undefined,
      visitDate: row.visitDate
        ? new Date(row.visitDate).toLocaleDateString()
        : "Unknown",
      doctorName: row.doctorName ?? undefined,
      diagnosis: row.diagnosis ?? undefined,
      medications: row.medications ?? [],
      instructions,
      followUpDate: row.followUpDate
        ? new Date(row.followUpDate).toLocaleDateString()
        : undefined,
      followUpNotes: row.followUpNotes ?? undefined,
      restrictions: row.restrictions ?? undefined,
      emergencyNotes: row.emergencyNotes ?? undefined,
    }).save(`discharge_${patient.name.replace(/\s+/g, "_")}.pdf`);
  }

  async function handleSpecializedUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadFileToApi(file, {
        category: docCategory,
        entityType: "patient",
        entityId: patient.id,
      });
      toast.success("Document uploaded");
      utils.records.listFilesForEntity.invalidate({
        entityType: "patient",
        entityId: patient.id,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Exam Vitals & Physical Exam" icon={Activity}>
        {vitalsQuery.data && vitalsQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {vitalsQuery.data.map((v) => (
              <li
                key={v.id}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {v.recordedAt
                      ? new Date(v.recordedAt).toLocaleString()
                      : "Unknown"}
                  </span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {v.examStatus?.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {[
                    v.weightKg ? `${v.weightKg} kg` : null,
                    v.temperatureF ? `${v.temperatureF} °F` : null,
                    v.heartRate ? `HR ${v.heartRate}` : null,
                    v.respiratoryRate ? `RR ${v.respiratoryRate}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No measurements"}
                </p>
                {v.examNotes && (
                  <p className="mt-1 text-xs text-muted-foreground">{v.examNotes}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
        )}
        {canManage && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createVitals.mutate({
                patientId: patient.id,
                weightKg: vitalsForm.weightKg || undefined,
                temperatureF: vitalsForm.temperatureF || undefined,
                heartRate: vitalsForm.heartRate
                  ? Number(vitalsForm.heartRate)
                  : undefined,
                respiratoryRate: vitalsForm.respiratoryRate
                  ? Number(vitalsForm.respiratoryRate)
                  : undefined,
                examStatus: vitalsForm.examStatus,
                examNotes: vitalsForm.examNotes || undefined,
              });
            }}
          >
            <Input
              placeholder="Weight (kg)"
              value={vitalsForm.weightKg}
              onChange={(e) =>
                setVitalsForm((f) => ({ ...f, weightKg: e.target.value }))
              }
            />
            <Input
              placeholder="Temp (°F)"
              value={vitalsForm.temperatureF}
              onChange={(e) =>
                setVitalsForm((f) => ({ ...f, temperatureF: e.target.value }))
              }
            />
            <Input
              placeholder="Heart rate"
              value={vitalsForm.heartRate}
              onChange={(e) =>
                setVitalsForm((f) => ({ ...f, heartRate: e.target.value }))
              }
            />
            <Input
              placeholder="Respiratory rate"
              value={vitalsForm.respiratoryRate}
              onChange={(e) =>
                setVitalsForm((f) => ({ ...f, respiratoryRate: e.target.value }))
              }
            />
            <select
              value={vitalsForm.examStatus}
              onChange={(e) =>
                setVitalsForm((f) => ({
                  ...f,
                  examStatus: e.target.value as typeof vitalsForm.examStatus,
                }))
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm sm:col-span-2"
            >
              {EXAM_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Physical exam: {o.label}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Exam notes"
              value={vitalsForm.examNotes}
              onChange={(e) =>
                setVitalsForm((f) => ({ ...f, examNotes: e.target.value }))
              }
            />
            <Button
              type="submit"
              size="sm"
              className="sm:col-span-2"
              disabled={createVitals.isPending}
            >
              Record vitals
            </Button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Client Consent / Decline" icon={ClipboardCheck}>
        {consentsQuery.data && consentsQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {consentsQuery.data.map((c) => (
              <li key={c.id} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.recommendation}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                      c.decision === "consented"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {c.decision}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.documentedAt
                    ? new Date(c.documentedAt).toLocaleString()
                    : ""}{" "}
                  — {c.authorName}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No consent records yet.</p>
        )}
        {canManage && patient.clientId && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createConsent.mutate({
                patientId: patient.id,
                clientId: patient.clientId!,
                recommendation: consentForm.recommendation,
                decision: consentForm.decision,
                risks: consentForm.risks || undefined,
                benefits: consentForm.benefits || undefined,
                estimatedCost: consentForm.estimatedCost || undefined,
                notes: consentForm.notes || undefined,
              });
            }}
          >
            <Input
              placeholder="Recommendation *"
              value={consentForm.recommendation}
              onChange={(e) =>
                setConsentForm((f) => ({ ...f, recommendation: e.target.value }))
              }
              required
            />
            <select
              value={consentForm.decision}
              onChange={(e) =>
                setConsentForm((f) => ({
                  ...f,
                  decision: e.target.value as typeof consentForm.decision,
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="consented">Client consented</option>
              <option value="declined">Client declined</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Risks discussed"
                value={consentForm.risks}
                onChange={(e) =>
                  setConsentForm((f) => ({ ...f, risks: e.target.value }))
                }
              />
              <Input
                placeholder="Benefits discussed"
                value={consentForm.benefits}
                onChange={(e) =>
                  setConsentForm((f) => ({ ...f, benefits: e.target.value }))
                }
              />
            </div>
            <Input
              placeholder="Estimated cost"
              value={consentForm.estimatedCost}
              onChange={(e) =>
                setConsentForm((f) => ({ ...f, estimatedCost: e.target.value }))
              }
            />
            <Button type="submit" size="sm" disabled={createConsent.isPending}>
              Document consent
            </Button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Discharge Instructions" icon={FileText}>
        {dischargeQuery.data && dischargeQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {dischargeQuery.data.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">
                    Visit{" "}
                    {d.visitDate
                      ? new Date(d.visitDate).toLocaleDateString()
                      : "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Issued {d.issuedAt ? new Date(d.issuedAt).toLocaleString() : ""}{" "}
                    by {d.authorName}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadStoredDischarge(d)}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" />
                  PDF
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No discharge instructions on file.
          </p>
        )}
        {canManage && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={dischargeForm.visitDate}
                onChange={(e) =>
                  setDischargeForm((f) => ({ ...f, visitDate: e.target.value }))
                }
              />
              <Input
                placeholder="Doctor name"
                value={dischargeForm.doctorName}
                onChange={(e) =>
                  setDischargeForm((f) => ({ ...f, doctorName: e.target.value }))
                }
              />
            </div>
            <Input
              placeholder="Diagnosis"
              value={dischargeForm.diagnosis}
              onChange={(e) =>
                setDischargeForm((f) => ({ ...f, diagnosis: e.target.value }))
              }
            />
            <textarea
              rows={4}
              placeholder="Care instructions (one per line)"
              value={dischargeForm.instructions}
              onChange={(e) =>
                setDischargeForm((f) => ({ ...f, instructions: e.target.value }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => handleDischargeSave(true)}
                disabled={createDischarge.isPending}
              >
                Save & download PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDischargeSave(false)}
                disabled={createDischarge.isPending}
              >
                Save to record
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Treatment Administration Log" icon={Pill}>
        {treatmentsQuery.data && treatmentsQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {treatmentsQuery.data.map((t) => (
              <li key={t.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  {t.medicationName}
                  {t.dosage ? ` — ${t.dosage}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.administeredAt
                    ? new Date(t.administeredAt).toLocaleString()
                    : ""}{" "}
                  · {t.route ?? "route n/a"} · {t.administratorName}
                </p>
                {t.responseToTreatment && (
                  <p className="mt-1 text-xs">Response: {t.responseToTreatment}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No treatments logged.</p>
        )}
        {canManage && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createTreatment.mutate({
                patientId: patient.id,
                medicationName: treatmentForm.medicationName,
                dosage: treatmentForm.dosage || undefined,
                route: treatmentForm.route,
                responseToTreatment:
                  treatmentForm.responseToTreatment || undefined,
                notes: treatmentForm.notes || undefined,
              });
            }}
          >
            <Input
              className="sm:col-span-2"
              placeholder="Medication / treatment *"
              value={treatmentForm.medicationName}
              onChange={(e) =>
                setTreatmentForm((f) => ({
                  ...f,
                  medicationName: e.target.value,
                }))
              }
              required
            />
            <Input
              placeholder="Dosage"
              value={treatmentForm.dosage}
              onChange={(e) =>
                setTreatmentForm((f) => ({ ...f, dosage: e.target.value }))
              }
            />
            <select
              value={treatmentForm.route}
              onChange={(e) =>
                setTreatmentForm((f) => ({
                  ...f,
                  route: e.target.value as typeof treatmentForm.route,
                }))
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ROUTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Input
              className="sm:col-span-2"
              placeholder="Response to treatment"
              value={treatmentForm.responseToTreatment}
              onChange={(e) =>
                setTreatmentForm((f) => ({
                  ...f,
                  responseToTreatment: e.target.value,
                }))
              }
            />
            <Button
              type="submit"
              size="sm"
              className="sm:col-span-2"
              disabled={createTreatment.isPending}
            >
              Log administration
            </Button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Custody (Hospitalization / Boarding)" icon={HeartPulse}>
        {custodyQuery.data && custodyQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {custodyQuery.data.map((c) => (
              <li key={c.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  {c.custodyStart
                    ? new Date(c.custodyStart).toLocaleString()
                    : "Start unknown"}
                  {" → "}
                  {c.custodyEnd
                    ? new Date(c.custodyEnd).toLocaleString()
                    : "ongoing"}
                </p>
                {c.reason && (
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No custody periods recorded.</p>
        )}
        {canManage && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custodyForm.custodyStart) {
                toast.error("Custody start is required");
                return;
              }
              createCustody.mutate({
                patientId: patient.id,
                custodyStart: new Date(custodyForm.custodyStart).toISOString(),
                custodyEnd: custodyForm.custodyEnd
                  ? new Date(custodyForm.custodyEnd).toISOString()
                  : undefined,
                reason: custodyForm.reason || undefined,
                notes: custodyForm.notes || undefined,
              });
            }}
          >
            <Input
              type="datetime-local"
              value={custodyForm.custodyStart}
              onChange={(e) =>
                setCustodyForm((f) => ({ ...f, custodyStart: e.target.value }))
              }
            />
            <Input
              type="datetime-local"
              value={custodyForm.custodyEnd}
              onChange={(e) =>
                setCustodyForm((f) => ({ ...f, custodyEnd: e.target.value }))
              }
            />
            <Input
              className="sm:col-span-2"
              placeholder="Reason"
              value={custodyForm.reason}
              onChange={(e) =>
                setCustodyForm((f) => ({ ...f, reason: e.target.value }))
              }
            />
            <Button
              type="submit"
              size="sm"
              className="sm:col-span-2"
              disabled={createCustody.isPending}
            >
              Record custody
            </Button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Anesthesia Records" icon={Activity}>
        {anesthesiaQuery.data && anesthesiaQuery.data.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {anesthesiaQuery.data.map((a) => (
              <li key={a.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium">
                  {a.createdAt
                    ? new Date(a.createdAt).toLocaleString()
                    : "Unknown"}{" "}
                  — {a.recorderName}
                </p>
                {a.protocol && (
                  <p className="text-xs text-muted-foreground">Protocol: {a.protocol}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No anesthesia records yet.</p>
        )}
        {canManage && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createAnesthesia.mutate({
                patientId: patient.id,
                protocol: anesthesiaForm.protocol || undefined,
                vitalSignsLog: anesthesiaForm.vitalSignsLog || undefined,
                complications: anesthesiaForm.complications || undefined,
                notes: anesthesiaForm.notes || undefined,
              });
            }}
          >
            <Input
              placeholder="Anesthesia protocol"
              value={anesthesiaForm.protocol}
              onChange={(e) =>
                setAnesthesiaForm((f) => ({ ...f, protocol: e.target.value }))
              }
            />
            <textarea
              rows={3}
              placeholder="Vital signs log"
              value={anesthesiaForm.vitalSignsLog}
              onChange={(e) =>
                setAnesthesiaForm((f) => ({ ...f, vitalSignsLog: e.target.value }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" disabled={createAnesthesia.isPending}>
              Save anesthesia record
            </Button>
          </form>
        )}
      </SectionCard>

      <SectionCard title="Specialized Chart Attachments" icon={Upload}>
        {specializedFiles.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {specializedFiles.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span>
                  {f.fileName}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({f.category})
                  </span>
                </span>
                {f.fileUrl && (
                  <a
                    href={f.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Upload cage charts, dental charts, surgical reports, or anesthesia monitors.
          </p>
        )}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={docCategory}
              onChange={(e) =>
                setDocCategory(
                  e.target.value as (typeof SPECIALIZED_DOC_CATEGORIES)[number]["value"]
                )
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SPECIALIZED_DOC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              ref={docInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleSpecializedUpload}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => docInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
