"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Activity,
  Shield,
  Camera,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateMedicalSummaryPdf } from "@/lib/pdf";
import {
  PatientAlerts,
  PatientClinicalAdd,
} from "@/components/patients/patient-clinical-add";
import {
  SoapNotesTab,
  PrescriptionsTab,
  ProblemsTab,
  LabResultsTab,
  ProceduresTab,
} from "@/components/patients/patient-clinical-tabs";
import { recordPatientView } from "@/lib/recent-patients";

const speciesEmoji: Record<string, string> = {
  canine: "\uD83D\uDC36",
  feline: "\uD83D\uDC31",
  avian: "\uD83D\uDC26",
  rabbit: "\uD83D\uDC30",
  reptile: "\uD83E\uDD8E",
  equine: "\uD83D\uDC34",
  other: "\uD83D\uDC3E",
};

function formatSex(sex: string | null): string {
  if (!sex) return "Unknown";
  const labels: Record<string, string> = {
    male: "Male (Intact)",
    female: "Female (Intact)",
    male_neutered: "Male (Neutered)",
    female_spayed: "Female (Spayed)",
  };
  return labels[sex] ?? sex;
}

function calculateAge(dob: string | null): string {
  if (!dob) return "Unknown";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const adjustedMonths = months < 0 ? months + 12 : months;
  const adjustedYears = months < 0 ? years - 1 : years;

  if (adjustedYears === 0) {
    return `${adjustedMonths} month${adjustedMonths !== 1 ? "s" : ""}`;
  }
  if (adjustedMonths === 0) {
    return `${adjustedYears} year${adjustedYears !== 1 ? "s" : ""}`;
  }
  return `${adjustedYears}y ${adjustedMonths}m`;
}

type Tab =
  | "overview"
  | "weight"
  | "soap"
  | "vaccinations"
  | "prescriptions"
  | "problems"
  | "labResults"
  | "procedures";

const allTabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "weight", label: "Weight" },
  { id: "soap", label: "SOAP Notes" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "problems", label: "Problems" },
  { id: "labResults", label: "Lab Results" },
  { id: "procedures", label: "Procedures" },
];

// Tabs hidden from front desk staff (clinical-only content)
const frontDeskRestrictedTabs: Tab[] = [
  "soap",
  "prescriptions",
  "labResults",
  "procedures",
];

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const tabs = allTabs.filter(
    (t) => userRole !== "front_desk" || !frontDeskRestrictedTabs.includes(t.id)
  );
  const canCreateSoap =
    userRole !== "front_desk" && userRole !== "technician";
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: patient, isLoading, error } = trpc.patients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  );

  useEffect(() => {
    if (!patient) return;
    recordPatientView({
      id: patient.id,
      name: patient.name,
      species: patient.species ?? null,
      breed: patient.breed ?? null,
      clientFirstName: patient.clientFirstName ?? null,
      clientLastName: patient.clientLastName ?? null,
    });
  }, [patient]);

  const updatePhotoMutation = trpc.patients.update.useMutation({
    onSuccess: () => {
      toast.success("Patient photo updated");
      utils.patients.getById.invalidate({ id: params.id });
    },
    onError: (err) => {
      toast.error(`Failed to update patient photo: ${err.message}`);
    },
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "patient-photos");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      updatePhotoMutation.mutate({ id: params.id, photoUrl: data.url });
    } catch {
      toast.error("Failed to upload photo");
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Medical summary PDF data queries (lazy -- only fetched on demand)
  const problemsQuery = trpc.records.listProblems.useQuery(
    { patientId: params.id },
    { enabled: false }
  );
  const vaccinationsQuery = trpc.records.listVaccinations.useQuery(
    { patientId: params.id },
    { enabled: false }
  );
  const soapNotesQuery = trpc.records.listSoapNotes.useQuery(
    { patientId: params.id },
    { enabled: false }
  );
  const prescriptionsQuery = trpc.records.listPrescriptions.useQuery(
    { patientId: params.id },
    { enabled: false }
  );

  async function handleDownloadSummary() {
    if (!patient) return;

    try {
      const [problemsResult, vaccinationsResult, soapNotesResult, prescriptionsResult] =
        await Promise.all([
          problemsQuery.refetch(),
          vaccinationsQuery.refetch(),
          soapNotesQuery.refetch(),
          prescriptionsQuery.refetch(),
        ]);

      const problems = problemsResult.data ?? [];
      const vaccinations = vaccinationsResult.data ?? [];
      const soapNotes = soapNotesResult.data ?? [];
      const prescriptions = prescriptionsResult.data ?? [];

      generateMedicalSummaryPdf({
        practiceName: "",
        patientName: patient.name,
        species: patient.species ?? "Unknown",
        breed: patient.breed ?? undefined,
        sex: patient.sex ?? undefined,
        dob: patient.dob ?? undefined,
        color: patient.color ?? undefined,
        microchip: patient.microchipNumber ?? undefined,
        clientName: [patient.clientFirstName, patient.clientLastName]
          .filter(Boolean)
          .join(" "),
        allergies: (patient.allergies ?? []).map((a) => ({
          allergen: a.allergen,
          severity: a.severity ?? "unknown",
        })),
        problems: problems.map((p) => ({
          description: p.description,
          status: p.status ?? "active",
          onsetDate: p.onsetDate ?? undefined,
        })),
        vaccinations: vaccinations.map((v) => ({
          name: v.vaccineName,
          date: v.administeredAt
            ? new Date(v.administeredAt).toLocaleDateString()
            : "Unknown",
          nextDue: v.nextDueDate
            ? new Date(v.nextDueDate).toLocaleDateString()
            : undefined,
        })),
        recentNotes: soapNotes.slice(0, 5).map((n) => ({
          date: n.createdAt
            ? new Date(n.createdAt).toLocaleDateString()
            : "Unknown",
          subjective: n.subjective ?? undefined,
          objective: n.objective ?? undefined,
          assessment: n.assessment ?? undefined,
          plan: n.plan ?? undefined,
        })),
        prescriptions: prescriptions.map((rx) => ({
          medication: rx.medicationName,
          dosage: rx.dosage ?? "",
          frequency: rx.frequency ?? "",
          status: rx.status ?? "active",
        })),
      }).save(`${patient.name.replace(/\s+/g, "_")}_medical_summary.pdf`);

      toast.success("Medical summary downloaded");
    } catch {
      toast.error("Failed to generate medical summary");
    }
  }

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-12">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  if (!patient) return null;

  const statusColor =
    patient.status === "active"
      ? "bg-emerald-500"
      : patient.status === "deceased"
        ? "bg-gray-400"
        : "bg-amber-500";

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/patients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Patients
      </Button>

      {/* Patient Header Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="group relative h-14 w-14">
              {patient.photoUrl ? (
                <img
                  src={patient.photoUrl}
                  alt={patient.name}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
                  {speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                title="Upload photo"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-semibold">
                  {patient.name}
                </h2>
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    statusColor
                  )}
                  title={patient.status ?? "active"}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {patient.species &&
                  patient.species.charAt(0).toUpperCase() +
                    patient.species.slice(1)}
                {patient.breed ? ` \u00B7 ${patient.breed}` : ""}
                {" \u00B7 "}
                {calculateAge(patient.dob)}
                {" \u00B7 "}
                {formatSex(patient.sex)}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {patient.color && <span>Color: {patient.color}</span>}
                {patient.microchipNumber && (
                  <span>Microchip: {patient.microchipNumber}</span>
                )}
              </div>
              {patient.clientFirstName && (
                <button
                  onClick={() => router.push(`/clients/${patient.clientId}`)}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <User className="h-3.5 w-3.5" />
                  {patient.clientFirstName} {patient.clientLastName}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadSummary}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/patients/${patient.id}/edit`)}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Allergy Alert Bar */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Allergies
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {patient.allergies.map((allergy) => (
                <span
                  key={allergy.id}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    allergy.severity === "severe"
                      ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                      : allergy.severity === "moderate"
                        ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  )}
                >
                  {allergy.allergen}
                  {allergy.severity === "severe" ? " (!)" : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <PatientAlerts
        patientId={patient.id}
        allergyCount={patient.allergies?.length ?? 0}
      />

      <div className="mt-4">
        <PatientClinicalAdd patientId={patient.id} />
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-heading text-base font-semibold mb-4">
              Basic Information
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="mt-0.5 text-sm font-medium">{patient.name}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Species</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.species
                    ? patient.species.charAt(0).toUpperCase() +
                      patient.species.slice(1)
                    : "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Breed</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.breed || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Sex</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {formatSex(patient.sex)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Date of Birth</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.dob
                    ? new Date(patient.dob).toLocaleDateString()
                    : "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Age</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {calculateAge(patient.dob)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Color</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.color || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Microchip Number
                </dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.microchipNumber || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className="mt-0.5 text-sm font-medium capitalize">
                  {patient.status ?? "active"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Owner</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {patient.clientFirstName
                    ? `${patient.clientFirstName} ${patient.clientLastName}`
                    : "\u2014"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === "weight" && (
          <div>
            {patient.weights && patient.weights.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Weight (kg)
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        Recorded By
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {patient.weights.map((weight) => (
                      <tr
                        key={weight.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3">
                          {weight.recordedAt
                            ? new Date(weight.recordedAt).toLocaleDateString()
                            : "\u2014"}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {weight.weightKg} kg
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {weight.recordedBy ?? "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No weight records yet
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "vaccinations" && (
          <VaccinationsTab patientId={patient.id} />
        )}

        {activeTab === "soap" && (
          <SoapNotesTab
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
            }}
            canCreate={canCreateSoap}
          />
        )}

        {activeTab === "prescriptions" && (
          <PrescriptionsTab
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
            }}
          />
        )}

        {activeTab === "problems" && (
          <ProblemsTab
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
            }}
          />
        )}

        {activeTab === "labResults" && (
          <LabResultsTab
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
            }}
          />
        )}

        {activeTab === "procedures" && (
          <ProceduresTab
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
            }}
          />
        )}
      </div>
    </div>
  );
}

function VaccinationsTab({ patientId }: { patientId: string }) {
  const { data: vaccinations, isLoading } =
    trpc.records.listVaccinations.useQuery({ patientId });

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-8">Loading...</div>
    );
  }

  if (!vaccinations || vaccinations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No vaccination records yet
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Vaccine Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Date Given
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Next Due
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Lot Number
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Administered By
            </th>
          </tr>
        </thead>
        <tbody>
          {vaccinations.map((vax) => (
            <tr
              key={vax.id}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3 font-medium">{vax.vaccineName}</td>
              <td className="px-4 py-3">
                {vax.administeredAt
                  ? new Date(vax.administeredAt).toLocaleDateString()
                  : "\u2014"}
              </td>
              <td className="px-4 py-3">
                {vax.nextDueDate
                  ? new Date(vax.nextDueDate).toLocaleDateString()
                  : "\u2014"}
              </td>
              <td className="px-4 py-3">{vax.lotNumber ?? "\u2014"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {vax.administeredByName ?? "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

