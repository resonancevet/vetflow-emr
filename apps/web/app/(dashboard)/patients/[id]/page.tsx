"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  User,
  Activity,
  Shield,
  Camera,
  FileDown,
  Pencil,
  Trash2,
  LineChart as LineChartIcon,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generateMedicalSummaryPdf } from "@/lib/pdf";
import {
  PatientAlerts,
  PatientClinicalAdd,
  UnitToggle,
} from "@/components/patients/patient-clinical-add";
import {
  SoapNotesTab,
  PrescriptionsTab,
  ProblemsTab,
  LabResultsTab,
  ProceduresTab,
} from "@/components/patients/patient-clinical-tabs";
import { PatientComplianceSection } from "@/components/patients/patient-compliance-section";
import { PatientCommunicationsTab } from "@/components/patients/patient-communications-tab";
import { PatientAllergiesSection } from "@/components/patients/patient-allergies-section";
import { PatientAlertsBanner } from "@/components/patients/patient-alerts-banner";
import { ClientAlertIcon } from "@/components/clients/client-alerts-banner";
import { recordPatientView } from "@/lib/recent-patients";
import {
  kgToLb,
  toKgString,
  useWeightUnit,
  type WeightUnit,
} from "@/lib/weight-units";

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
  | "communication"
  | "soap"
  | "vaccinations"
  | "prescriptions"
  | "problems"
  | "labResults"
  | "procedures"
  | "compliance";

const allTabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "weight", label: "Weight" },
  { id: "communication", label: "Communication" },
  { id: "soap", label: "SOAP Notes" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "problems", label: "Problems" },
  { id: "labResults", label: "Lab Results" },
  { id: "procedures", label: "Procedures" },
  { id: "compliance", label: "Compliance" },
];

// Tabs hidden from front desk staff (clinical-only content)
const frontDeskRestrictedTabs: Tab[] = [
  "soap",
  "prescriptions",
  "labResults",
  "procedures",
  "compliance",
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
  const canManageClinicalRecords = userRole !== "front_desk";
  const canManagePrescriptions =
    userRole === "admin" || userRole === "veterinarian";
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [weightUnit, setWeightUnit] = useWeightUnit();
  const [weightView, setWeightView] = useState<"list" | "graph">("list");

  const formatWeight = (kgString: string | null) => {
    if (!kgString) return "\u2014";
    const kg = parseFloat(kgString);
    if (!Number.isFinite(kg)) return kgString;
    if (weightUnit === "lb") return `${kgToLb(kg).toFixed(2)} lb`;
    return `${kg.toFixed(2)} kg`;
  };

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
        clientAddress: patient.clientAddress ?? undefined,
        clientPhone: patient.clientPhone ?? undefined,
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
          diagnosis: n.diagnosis ?? undefined,
          prognosis: n.prognosis ?? undefined,
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
              {patient.clientFirstName && patient.clientId && (
                <div className="mt-2 inline-flex items-center gap-1.5">
                  <button
                    onClick={() => router.push(`/clients/${patient.clientId}`)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <User className="h-3.5 w-3.5" />
                    {patient.clientFirstName} {patient.clientLastName}
                  </button>
                  <ClientAlertIcon clientId={patient.clientId} />
                </div>
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

      <PatientAlertsBanner
        patientId={patient.id}
        canManage={canManageClinicalRecords}
      />

      <PatientAlerts
        patientId={patient.id}
        allergies={patient.allergies ?? []}
      />

      <div className="mt-4">
        <PatientClinicalAdd patientId={patient.id} />
      </div>

      {/* Tab navigation: vertical rail on lg+, horizontal scroll on smaller */}
      <div className="mt-6 lg:flex lg:gap-6">
        <nav
          className="mb-4 shrink-0 overflow-x-auto border-b border-border lg:mb-0 lg:w-44 lg:border-b-0 lg:border-r lg:pr-4"
          aria-label="Patient sections"
        >
          <ul className="flex min-w-max gap-0 lg:flex-col lg:min-w-0">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative w-full whitespace-nowrap px-4 py-3 text-left text-sm font-medium transition-colors min-h-11 lg:rounded-md",
                    activeTab === tab.id
                      ? "text-primary lg:bg-primary/10"
                      : "text-muted-foreground hover:text-foreground lg:hover:bg-muted/50"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary lg:bottom-auto lg:left-0 lg:top-2 lg:bottom-2 lg:w-0.5 lg:h-auto lg:right-auto" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
        {activeTab === "overview" && (
          <div className="space-y-6">
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
          <PatientAllergiesSection
            patientId={patient.id}
            allergies={patient.allergies ?? []}
            canManage={canManageClinicalRecords}
          />
          </div>
        )}

        {activeTab === "communication" && patient.clientId && (
          <PatientCommunicationsTab
            patientId={patient.id}
            clientId={patient.clientId}
            clientLabel={`${patient.clientFirstName ?? ""} ${patient.clientLastName ?? ""}`.trim()}
          />
        )}

        {activeTab === "weight" && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Stored in kilograms; toggle to display in pounds.
              </p>
              <div className="flex items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setWeightView("list")}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors",
                      weightView === "list"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightView("graph")}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors",
                      weightView === "graph"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <LineChartIcon className="h-3.5 w-3.5" />
                    Graph
                  </button>
                </div>
                <UnitToggle unit={weightUnit} onChange={setWeightUnit} />
              </div>
            </div>
            {patient.weights && patient.weights.length > 0 ? (
              weightView === "graph" ? (
                <WeightChart weights={patient.weights} unit={weightUnit} />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Weight ({weightUnit})
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                          Recorded By
                        </th>
                        {canManageClinicalRecords ? (
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                            Actions
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {patient.weights.map((weight) => (
                        <WeightRow
                          key={weight.id}
                          weight={weight}
                          unit={weightUnit}
                          formatWeight={formatWeight}
                          canManage={canManageClinicalRecords}
                          patientId={patient.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
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
          <VaccinationsTab
            patientId={patient.id}
            canManage={canManageClinicalRecords}
          />
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
            canManage={canManagePrescriptions}
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
            canManage={canManageClinicalRecords}
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
            canManage={canManagePrescriptions}
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
            canManage={canManagePrescriptions}
          />
        )}

        {activeTab === "compliance" && (
          <PatientComplianceSection
            patient={{
              id: patient.id,
              name: patient.name,
              species: patient.species ?? null,
              microchipNumber: patient.microchipNumber,
              clientId: patient.clientId,
              clientFirstName: patient.clientFirstName ?? null,
              clientLastName: patient.clientLastName ?? null,
              clientPhone: patient.clientPhone,
              clientAddress: patient.clientAddress,
            }}
            canManage={canManageClinicalRecords}
          />
        )}
        </div>
      </div>
    </div>
  );
}

function VaccinationsTab({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: vaccinations, isLoading } =
    trpc.records.listVaccinations.useQuery({ patientId });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vaccineName: "",
    lotNumber: "",
    manufacturer: "",
    administeredAt: "",
    nextDueDate: "",
    notes: "",
  });

  const invalidate = () =>
    utils.records.listVaccinations.invalidate({ patientId });

  const updateVaccination = trpc.records.updateVaccination.useMutation({
    onSuccess: () => {
      toast.success("Vaccination updated");
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteVaccination = trpc.records.deleteVaccination.useMutation({
    onSuccess: () => {
      toast.success("Vaccination removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startEditVaccination = (
    vax: NonNullable<typeof vaccinations>[number]
  ) => {
    setEditingId(vax.id);
    setForm({
      vaccineName: vax.vaccineName,
      lotNumber: vax.lotNumber ?? "",
      manufacturer: vax.manufacturer ?? "",
      administeredAt: vax.administeredAt
        ? new Date(vax.administeredAt).toISOString().slice(0, 10)
        : "",
      nextDueDate: vax.nextDueDate ?? "",
      notes: vax.notes ?? "",
    });
  };

  const saveVaccination = () => {
    if (!editingId) return;
    updateVaccination.mutate({
      id: editingId,
      vaccineName: form.vaccineName.trim(),
      lotNumber: form.lotNumber || undefined,
      manufacturer: form.manufacturer || undefined,
      administeredAt: form.administeredAt || undefined,
      nextDueDate: form.nextDueDate || undefined,
      notes: form.notes || undefined,
    });
  };

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
              Notes
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Administered By
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {vaccinations.map((vax) => {
            const isEditing = editingId === vax.id;
            return (
              <tr
                key={vax.id}
                className="border-b border-border align-top last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {isEditing ? (
                    <Input
                      value={form.vaccineName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vaccineName: e.target.value }))
                      }
                      required
                    />
                  ) : (
                    vax.vaccineName
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      type="date"
                      value={form.administeredAt}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          administeredAt: e.target.value,
                        }))
                      }
                    />
                  ) : vax.administeredAt ? (
                    new Date(vax.administeredAt).toLocaleDateString()
                  ) : (
                    "\u2014"
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      type="date"
                      value={form.nextDueDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nextDueDate: e.target.value }))
                      }
                    />
                  ) : vax.nextDueDate ? (
                    new Date(vax.nextDueDate).toLocaleDateString()
                  ) : (
                    "\u2014"
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="grid min-w-[10rem] gap-2">
                      <Input
                        value={form.lotNumber}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, lotNumber: e.target.value }))
                        }
                        placeholder="Lot"
                      />
                      <Input
                        value={form.manufacturer}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            manufacturer: e.target.value,
                          }))
                        }
                        placeholder="Manufacturer"
                      />
                    </div>
                  ) : (
                    vax.lotNumber ?? "\u2014"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {isEditing ? (
                    <Input
                      value={form.notes}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      placeholder="Notes"
                    />
                  ) : (
                    <span className="block max-w-[16rem] whitespace-pre-wrap break-words">
                      {vax.notes || "\u2014"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {vax.administeredByName ?? "\u2014"}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            disabled={updateVaccination.isPending}
                            onClick={saveVaccination}
                          >
                            {updateVaccination.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateVaccination.isPending}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditVaccination(vax)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteVaccination.isPending}
                            onClick={() => {
                              if (confirm("Remove this vaccination record?")) {
                                deleteVaccination.mutate({ id: vax.id });
                              }
                            }}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type WeightHistoryItem = {
  id: string;
  weightKg: string | null;
  recordedAt: Date | string | null;
  recordedBy: string | null;
  updatedAt: Date | string | null;
};

function WeightChart({
  weights,
  unit,
}: {
  weights: WeightHistoryItem[];
  unit: WeightUnit;
}) {
  // Recharts plots left-to-right; oldest first reads naturally over time.
  const data = weights
    .filter((w) => w.weightKg && w.recordedAt)
    .map((w) => {
      const kg = parseFloat(w.weightKg as string);
      const value = unit === "lb" ? kgToLb(kg) : kg;
      const date = new Date(w.recordedAt as string | Date);
      return {
        timestamp: date.getTime(),
        label: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
        weight: Number.isFinite(value)
          ? Number(value.toFixed(2))
          : null,
      };
    })
    .filter((d) => d.weight !== null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <LineChartIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          At least two weight entries are needed to draw a graph.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="currentColor"
              className="text-muted-foreground"
              width={48}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              formatter={(value: number) => [`${value} ${unit}`, "Weight"]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#0d9488"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function WeightRow({
  weight,
  unit,
  formatWeight,
  canManage,
  patientId,
}: {
  weight: WeightHistoryItem;
  unit: WeightUnit;
  formatWeight: (kg: string | null) => string;
  canManage: boolean;
  patientId: string;
}) {
  const utils = trpc.useUtils();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    if (!weight.weightKg) {
      setDraft("");
    } else {
      const kg = parseFloat(weight.weightKg);
      const display = unit === "lb" ? kgToLb(kg) : kg;
      setDraft(Number.isFinite(display) ? display.toFixed(2) : "");
    }
    setIsEditing(true);
  };

  const invalidate = async () => {
    await utils.patients.getById.invalidate({ id: patientId });
  };

  const updateMutation = trpc.patients.updateWeight.useMutation({
    onSuccess: async () => {
      toast.success("Weight updated");
      setIsEditing(false);
      await invalidate();
    },
    onError: (err) => toast.error(`Failed to update weight: ${err.message}`),
  });

  const deleteMutation = trpc.patients.deleteWeight.useMutation({
    onSuccess: async () => {
      toast.success("Weight removed");
      await invalidate();
    },
    onError: (err) => toast.error(`Failed to delete weight: ${err.message}`),
  });

  const handleSave = () => {
    const kg = toKgString(draft, unit);
    if (!kg) {
      toast.error("Enter a valid weight.");
      return;
    }
    updateMutation.mutate({
      id: weight.id,
      weightKg: kg,
      clientUpdatedAt: weight.updatedAt
        ? new Date(weight.updatedAt)
        : undefined,
    });
  };

  return (
    <tr className="border-b border-border last:border-0 align-middle">
      <td className="px-4 py-3">
        {weight.recordedAt
          ? new Date(weight.recordedAt).toLocaleDateString()
          : "\u2014"}
      </td>
      <td className="px-4 py-3 font-medium">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-32"
          />
        ) : (
          formatWeight(weight.weightKg)
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {weight.recordedBy ?? "\u2014"}
      </td>
      {canManage ? (
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditing}
                  disabled={deleteMutation.isPending}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (confirm("Remove this weight entry?")) {
                      deleteMutation.mutate({ id: weight.id });
                    }
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

