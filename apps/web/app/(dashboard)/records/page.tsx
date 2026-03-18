"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  FileText,
  Syringe,
  Pill,
  ClipboardList,
  Plus,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Scissors,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Tab = "soap" | "vaccinations" | "prescriptions" | "problems" | "labResults" | "procedures";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "soap", label: "SOAP Notes", icon: FileText },
  { id: "vaccinations", label: "Vaccinations", icon: Syringe },
  { id: "prescriptions", label: "Prescriptions", icon: Pill },
  { id: "problems", label: "Problems", icon: ClipboardList },
  { id: "labResults", label: "Lab Results", icon: FlaskConical },
  { id: "procedures", label: "Procedures", icon: Scissors },
];

function getVaccineDueStatus(nextDueDate: string | null): {
  label: string;
  className: string;
} {
  if (!nextDueDate) return { label: "N/A", className: "text-muted-foreground" };
  const now = new Date();
  const due = new Date(nextDueDate);
  const daysUntilDue = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDue < 0)
    return {
      label: "Overdue",
      className:
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  if (daysUntilDue <= 30)
    return {
      label: "Due Soon",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  return {
    label: "Current",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

function getLabStatusBadge(status: string | null) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "reviewed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function isOutOfRange(
  resultValue: string | null,
  low: string | null,
  high: string | null
): boolean {
  if (!resultValue) return false;
  const val = parseFloat(resultValue);
  if (isNaN(val)) return false;
  if (low !== null && low !== undefined) {
    const lowVal = parseFloat(low);
    if (!isNaN(lowVal) && val < lowVal) return true;
  }
  if (high !== null && high !== undefined) {
    const highVal = parseFloat(high);
    if (!isNaN(highVal) && val > highVal) return true;
  }
  return false;
}

function getPrescriptionStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "discontinued":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

// Tabs restricted from front_desk: SOAP Notes, Prescriptions, Lab Results, Procedures
const frontDeskRestrictedTabs: Tab[] = ["soap", "prescriptions", "labResults", "procedures"];

export default function RecordsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    breed: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("soap");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showLabForm, setShowLabForm] = useState(false);
  const [showProcedureForm, setShowProcedureForm] = useState(false);

  const { data: searchResults } = trpc.patients.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 1 }
  );

  const patientId = selectedPatient?.id ?? "";

  const { data: soapNotes } = trpc.records.listSoapNotes.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: vaccinations } = trpc.records.listVaccinations.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: prescriptionsList } = trpc.records.listPrescriptions.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: problems } = trpc.records.listProblems.useQuery(
    { patientId },
    { enabled: !!patientId }
  );
  const { data: labResultsList, refetch: refetchLabResults } =
    trpc.records.listLabResults.useQuery(
      { patientId },
      { enabled: !!patientId }
    );
  const { data: proceduresList, refetch: refetchProcedures } =
    trpc.records.listProcedures.useQuery(
      { patientId },
      { enabled: !!patientId }
    );

  const createLabResult = trpc.records.createLabResult.useMutation({
    onSuccess: () => {
      refetchLabResults();
      setShowLabForm(false);
    },
  });
  const updateLabResultStatus =
    trpc.records.updateLabResultStatus.useMutation({
      onSuccess: () => {
        refetchLabResults();
      },
    });
  const createProcedure = trpc.records.createProcedure.useMutation({
    onSuccess: () => {
      refetchProcedures();
      setShowProcedureForm(false);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Medical Records
          </h2>
          <p className="text-sm text-muted-foreground">
            Clinical documentation and patient history
          </p>
        </div>
        {selectedPatient && userRole !== "front_desk" && userRole !== "technician" && (
          <Button
            onClick={() =>
              router.push(`/records/new-soap/${selectedPatient.id}`)
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New SOAP Note
          </Button>
        )}
      </div>

      {/* Patient Search */}
      <div className="mt-6 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients by name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSelectedPatient(null);
            }}
            className="pl-10"
          />
        </div>

        {/* Search Dropdown */}
        {searchQuery.length >= 1 && !selectedPatient && searchResults && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No patients found
              </div>
            ) : (
              searchResults.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchQuery(patient.name);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                >
                  <div>
                    <span className="font-medium">{patient.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {patient.species
                        ? patient.species.charAt(0).toUpperCase() +
                          patient.species.slice(1)
                        : ""}
                      {patient.breed ? ` - ${patient.breed}` : ""}
                    </span>
                  </div>
                  {patient.clientFirstName && (
                    <span className="text-xs text-muted-foreground">
                      Owner: {patient.clientFirstName}{" "}
                      {patient.clientLastName}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Patient Banner */}
      {selectedPatient && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div className="text-sm">
            <span className="font-medium">{selectedPatient.name}</span>
            <span className="ml-2 text-muted-foreground">
              {selectedPatient.species
                ? selectedPatient.species.charAt(0).toUpperCase() +
                  selectedPatient.species.slice(1)
                : ""}
              {selectedPatient.breed ? ` - ${selectedPatient.breed}` : ""}
            </span>
            {selectedPatient.clientFirstName && (
              <span className="ml-3 text-muted-foreground">
                Owner: {selectedPatient.clientFirstName}{" "}
                {selectedPatient.clientLastName}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedPatient(null);
              setSearchQuery("");
            }}
          >
            Change Patient
          </Button>
        </div>
      )}

      {/* Tabs */}
      {selectedPatient && (
        <>
          <div className="mt-6 border-b border-border">
            <div className="flex gap-0">
              {tabs
                .filter((tab) => userRole !== "front_desk" || !frontDeskRestrictedTabs.includes(tab.id))
                .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {/* SOAP Notes Tab */}
            {activeTab === "soap" && (
              <div>
                {soapNotes && soapNotes.length > 0 ? (
                  <div className="space-y-3">
                    {soapNotes.map((note) => {
                      const isExpanded = expandedNoteId === note.id;
                      return (
                        <div
                          key={note.id}
                          className="rounded-lg border border-border bg-card"
                        >
                          <button
                            onClick={() =>
                              setExpandedNoteId(isExpanded ? null : note.id)
                            }
                            className="flex w-full items-center justify-between px-4 py-3 text-left"
                          >
                            <div className="flex items-center gap-4">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">
                                  {note.createdAt
                                    ? new Date(
                                        note.createdAt
                                      ).toLocaleDateString()
                                    : "No date"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {note.authorName ?? "Unknown author"}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">
                                {note.assessment || "No assessment recorded"}
                              </p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t border-border px-4 py-4 space-y-4">
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Subjective
                                </h4>
                                <p className="text-sm">
                                  {note.subjective || "--"}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Objective
                                </h4>
                                <p className="text-sm">
                                  {note.objective || "--"}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Assessment
                                </h4>
                                <p className="text-sm">
                                  {note.assessment || "--"}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                  Plan
                                </h4>
                                <p className="text-sm">{note.plan || "--"}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No SOAP notes yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() =>
                        router.push(
                          `/records/new-soap/${selectedPatient.id}`
                        )
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Note
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Vaccinations Tab */}
            {activeTab === "vaccinations" && (
              <div>
                {vaccinations && vaccinations.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Vaccine
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Date Administered
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Next Due
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Administered By
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {vaccinations.map((vax) => {
                          const dueStatus = getVaccineDueStatus(
                            vax.nextDueDate
                          );
                          return (
                            <tr
                              key={vax.id}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-4 py-3 font-medium">
                                {vax.vaccineName}
                              </td>
                              <td className="px-4 py-3">
                                {vax.administeredAt
                                  ? new Date(
                                      vax.administeredAt
                                    ).toLocaleDateString()
                                  : "--"}
                              </td>
                              <td className="px-4 py-3">
                                {vax.nextDueDate
                                  ? new Date(
                                      vax.nextDueDate
                                    ).toLocaleDateString()
                                  : "--"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {vax.administeredByName ?? "--"}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                    dueStatus.className
                                  )}
                                >
                                  {dueStatus.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <Syringe className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No vaccination records yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Prescriptions Tab */}
            {activeTab === "prescriptions" && (
              <div>
                {prescriptionsList && prescriptionsList.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Medication
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Dosage
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Frequency
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Refills
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {prescriptionsList.map((rx) => (
                          <tr
                            key={rx.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {rx.medicationName}
                            </td>
                            <td className="px-4 py-3">{rx.dosage ?? "--"}</td>
                            <td className="px-4 py-3">
                              {rx.frequency ?? "--"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                  getPrescriptionStatusBadge(rx.status)
                                )}
                              >
                                {rx.status ?? "unknown"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {rx.refillsRemaining ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <Pill className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No prescriptions yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Problems Tab */}
            {activeTab === "problems" && (
              <div>
                {problems && problems.length > 0 ? (
                  <div className="space-y-2">
                    {problems.map((problem) => (
                      <div
                        key={problem.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              problem.status === "active"
                                ? "font-semibold"
                                : "font-normal"
                            )}
                          >
                            {problem.description}
                          </p>
                          {problem.onsetDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Onset:{" "}
                              {new Date(
                                problem.onsetDate
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                            problem.status === "active"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : problem.status === "chronic"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}
                        >
                          {problem.status ?? "active"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No problems recorded
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Lab Results Tab */}
            {activeTab === "labResults" && (
              <div>
                <div className="flex justify-end mb-4">
                  <Button
                    size="sm"
                    onClick={() => setShowLabForm(!showLabForm)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lab Result
                  </Button>
                </div>

                {showLabForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);
                      createLabResult.mutate({
                        patientId,
                        testName: formData.get("testName") as string,
                        resultValue:
                          (formData.get("resultValue") as string) || undefined,
                        unit: (formData.get("unit") as string) || undefined,
                        referenceRangeLow:
                          (formData.get("referenceRangeLow") as string) ||
                          undefined,
                        referenceRangeHigh:
                          (formData.get("referenceRangeHigh") as string) ||
                          undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Test Name *
                        </label>
                        <Input name="testName" required placeholder="e.g. CBC" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Result Value
                        </label>
                        <Input
                          name="resultValue"
                          placeholder="e.g. 12.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Unit
                        </label>
                        <Input name="unit" placeholder="e.g. mg/dL" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Ref. Range Low
                        </label>
                        <Input
                          name="referenceRangeLow"
                          placeholder="e.g. 7.0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Ref. Range High
                        </label>
                        <Input
                          name="referenceRangeHigh"
                          placeholder="e.g. 27.0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={createLabResult.isPending}
                      >
                        {createLabResult.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLabForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {labResultsList && labResultsList.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Test Name
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Result
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Unit
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Reference Range
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Ordered By
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {labResultsList.map((lab) => {
                          const outOfRange = isOutOfRange(
                            lab.resultValue,
                            lab.referenceRangeLow,
                            lab.referenceRangeHigh
                          );
                          return (
                            <tr
                              key={lab.id}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-4 py-3 font-medium">
                                {lab.testName}
                              </td>
                              <td
                                className={cn(
                                  "px-4 py-3",
                                  outOfRange
                                    ? "text-red-600 font-semibold dark:text-red-400"
                                    : ""
                                )}
                              >
                                {lab.resultValue ?? "--"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {lab.unit ?? "--"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {lab.referenceRangeLow != null &&
                                lab.referenceRangeHigh != null
                                  ? `${lab.referenceRangeLow} - ${lab.referenceRangeHigh}`
                                  : "--"}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                    getLabStatusBadge(lab.status)
                                  )}
                                >
                                  {lab.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {lab.orderedByName ?? "--"}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {lab.createdAt
                                  ? new Date(
                                      lab.createdAt
                                    ).toLocaleDateString()
                                  : "--"}
                              </td>
                              <td className="px-4 py-3">
                                {lab.status === "completed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateLabResultStatus.mutate({
                                        id: lab.id,
                                        status: "reviewed",
                                      })
                                    }
                                    disabled={
                                      updateLabResultStatus.isPending
                                    }
                                  >
                                    Mark Reviewed
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No lab results yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Procedures Tab */}
            {activeTab === "procedures" && (
              <div>
                <div className="flex justify-end mb-4">
                  <Button
                    size="sm"
                    onClick={() => setShowProcedureForm(!showProcedureForm)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Procedure
                  </Button>
                </div>

                {showProcedureForm && (
                  <form
                    className="mb-6 rounded-lg border border-border bg-card p-4 space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);
                      const durationStr = formData.get(
                        "durationMinutes"
                      ) as string;
                      createProcedure.mutate({
                        patientId,
                        name: formData.get("name") as string,
                        description:
                          (formData.get("description") as string) || undefined,
                        anesthesiaUsed:
                          (formData.get("anesthesiaUsed") as string) ||
                          undefined,
                        durationMinutes: durationStr
                          ? parseInt(durationStr, 10)
                          : undefined,
                        notes:
                          (formData.get("notes") as string) || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Name *
                        </label>
                        <Input
                          name="name"
                          required
                          placeholder="e.g. Dental Prophylaxis"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Duration (minutes)
                        </label>
                        <Input
                          name="durationMinutes"
                          type="number"
                          placeholder="e.g. 45"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Description
                        </label>
                        <Input
                          name="description"
                          placeholder="Brief description of the procedure"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Anesthesia Used
                        </label>
                        <Input
                          name="anesthesiaUsed"
                          placeholder="e.g. Isoflurane"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          Notes
                        </label>
                        <Input name="notes" placeholder="Additional notes" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={createProcedure.isPending}
                      >
                        {createProcedure.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowProcedureForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {proceduresList && proceduresList.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Name
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Performed By
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Duration
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Anesthesia
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {proceduresList.map((proc) => (
                          <tr
                            key={proc.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium">{proc.name}</p>
                              {proc.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {proc.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.performedByName ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.durationMinutes
                                ? `${proc.durationMinutes} min`
                                : "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.anesthesiaUsed ?? "--"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {proc.createdAt
                                ? new Date(
                                    proc.createdAt
                                  ).toLocaleDateString()
                                : "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <Scissors className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No procedures recorded
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Prompt to search if no patient selected */}
      {!selectedPatient && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Search for a patient above to view their medical records
          </p>
        </div>
      )}
    </div>
  );
}
