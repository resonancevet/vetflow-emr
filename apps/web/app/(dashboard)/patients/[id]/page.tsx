"use client";

import { useState, useEffect } from "react";
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
import {
  PatientAlertsBanner,
  PatientAlertsManageButton,
} from "@/components/patients/patient-alerts-banner";
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

type ChartSection =
  | "medical"
  | "weight"
  | "communication"
  | "vaccines"
  | "prescriptions"
  | "labs"
  | "compliance";

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

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const canCreateSoap =
    userRole !== "front_desk" && userRole !== "technician";
  const canManageClinicalRecords = userRole !== "front_desk";
  const canManagePrescriptions =
    userRole === "admin" || userRole === "veterinarian";
  const [weightUnit, setWeightUnit] = useWeightUnit();
  const [weightView, setWeightView] = useState<"list" | "graph">("list");
  const [chartSection, setChartSection] = useState<ChartSection>("medical");

  const formatWeight = (kgString: string | null) => {
    if (!kgString) return "\u2014";
    const kg = parseFloat(kgString);
    if (!Number.isFinite(kg)) return kgString;
    if (weightUnit === "lb") return `${kgToLb(kg).toFixed(2)} lb`;
    return `${kg.toFixed(2)} kg`;
  };

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

  const chartNav: { id: ChartSection; label: string }[] = [
    ...(userRole !== "front_desk"
      ? [{ id: "medical" as const, label: "Medical Record" }]
      : []),
    { id: "weight", label: "Weight History" },
    ...(patient.clientId
      ? [{ id: "communication" as const, label: "Communication Log" }]
      : []),
    { id: "vaccines", label: "Vaccine History" },
    ...(userRole !== "front_desk"
      ? [
          { id: "prescriptions" as const, label: "Prescriptions" },
          { id: "labs" as const, label: "Lab Results" },
          { id: "compliance" as const, label: "Compliance" },
        ]
      : []),
  ];
  const activeChartSection = chartNav.some((item) => item.id === chartSection)
    ? chartSection
    : (chartNav[0]?.id ?? "weight");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/patients")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Patients
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/patients/${patient.id}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {canManageClinicalRecords && (
            <PatientAlertsManageButton patientId={patient.id} />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadSummary}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Download Summary
          </Button>
        </div>
      </div>

      {/* Patient Header Card */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-start">
          <div className="self-center px-4 py-4">
            <PatientPhoto
              name={patient.name}
              species={patient.species}
              photoUrl={patient.photoUrl}
              size="card"
            />
          </div>
          <div className="min-w-0 flex-1 py-4 pr-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
                {patient.clientFirstName && patient.clientId && (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/clients/${patient.clientId}`)
                      }
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <User className="h-3.5 w-3.5" />
                      {patient.clientFirstName} {patient.clientLastName}
                    </button>
                    <ClientAlertIcon clientId={patient.clientId} />
                  </span>
                )}
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Species</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.species
                      ? patient.species.charAt(0).toUpperCase() +
                        patient.species.slice(1)
                      : "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Breed</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.breed || "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sex</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {formatSex(patient.sex)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Date of Birth</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.dob
                      ? new Date(patient.dob).toLocaleDateString()
                      : "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Age</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {calculateAge(patient.dob)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Color</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.color || "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Microchip</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.microchipNumber || "\u2014"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-0.5 text-sm font-medium capitalize">
                    {patient.status ?? "active"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Weight</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {patient.weights?.[0]?.weightKg
                      ? `${formatWeight(patient.weights[0].weightKg)}${
                          patient.weights[0].recordedAt
                            ? ` (${new Date(
                                patient.weights[0].recordedAt
                              ).toLocaleDateString()})`
                            : ""
                        }`
                      : "\u2014"}
                  </dd>
                </div>
              </dl>
            </div>
          {(patient.allergies?.length ?? 0) > 0 ? (
            <div className="m-4 max-w-xs shrink-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-right text-sm dark:border-red-900 dark:bg-red-950/40">
              <p className="font-semibold text-red-800 dark:text-red-200">
                Allergies
              </p>
              <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                {patient.allergies.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex rounded-full bg-red-200 px-2.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900 dark:text-red-100"
                    title={
                      [a.severity, a.reaction].filter(Boolean).join(" · ") ||
                      undefined
                    }
                  >
                    {a.allergen}
                    {a.severity === "severe" ? " (!)" : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="m-4 shrink-0 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
              No Known Allergies
            </div>
          )}
        </div>
      </div>

      <PatientAlertsBanner patientId={patient.id} />

      <PatientAlerts patientId={patient.id} />

      <nav
        className="mt-4 border-b border-border"
        aria-label="Patient records"
      >
        <div className="flex flex-wrap gap-1">
          {chartNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChartSection(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                activeChartSection === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-4">
        <PatientClinicalAdd patientId={patient.id} />
      </div>

      <div className="mt-6 space-y-10">
        {activeChartSection === "weight" && (
        <section>
          <h3 className="mb-3 font-heading text-base font-semibold">Weight</h3>
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
        </section>
        )}

        {activeChartSection === "communication" && patient.clientId && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              Communication
            </h3>
            <PatientCommunicationsTab
              patientId={patient.id}
              clientId={patient.clientId}
              clientLabel={`${patient.clientFirstName ?? ""} ${patient.clientLastName ?? ""}`.trim()}
            />
          </section>
        )}

        {activeChartSection === "vaccines" && (
        <section>
          <h3 className="mb-3 font-heading text-base font-semibold">
            Vaccinations
          </h3>
          <VaccinationsTab
            patientId={patient.id}
            canManage={canManageClinicalRecords}
          />
        </section>
        )}

        {activeChartSection === "medical" && (
        <section>
          <h3 className="mb-3 font-heading text-base font-semibold">Problems</h3>
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
        </section>
        )}

        {activeChartSection === "medical" && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              SOAP Notes
            </h3>
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
          </section>
        )}

        {activeChartSection === "prescriptions" && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              Prescriptions
            </h3>
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
          </section>
        )}

        {activeChartSection === "labs" && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              Lab Results
            </h3>
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
          </section>
        )}

        {activeChartSection === "medical" && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              Procedures
            </h3>
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
          </section>
        )}

        {activeChartSection === "compliance" && (
          <section>
            <h3 className="mb-3 font-heading text-base font-semibold">
              Compliance
            </h3>
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
          </section>
        )}
      </div>
    </div>
  );
}

function PatientPhoto({
  name,
  species,
  photoUrl,
  size,
  uploading,
  onUploadClick,
}: {
  name: string;
  species: string | null;
  photoUrl: string | null;
  size: "sm" | "card" | "lg";
  uploading?: boolean;
  onUploadClick?: () => void;
}) {
  const frameClass =
    size === "sm"
      ? "h-14 w-14 rounded-full"
      : size === "card"
        ? "h-36 w-36 rounded-lg"
        : "h-40 w-40 rounded-lg";
  const emojiClass = size === "sm" ? "text-2xl" : "text-5xl";
  const cameraClass = size === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={cn("group relative shrink-0 overflow-hidden", frameClass)}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className={cn("h-full w-full object-cover", frameClass)}
        />
      ) : (
        <div
          className={cn(
            "flex items-center justify-center bg-muted",
            frameClass,
            emojiClass
          )}
        >
          {speciesEmoji[species ?? "other"] ?? "\uD83D\uDC3E"}
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
          Uploading...
        </div>
      )}
      {onUploadClick && !uploading && (
        <button
          type="button"
          onClick={onUploadClick}
          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          title="Upload photo"
        >
          <Camera className={cn(cameraClass, "text-white")} />
        </button>
      )}
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

