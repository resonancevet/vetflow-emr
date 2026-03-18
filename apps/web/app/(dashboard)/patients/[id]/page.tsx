"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  User,
  Activity,
  Shield,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type Tab = "overview" | "weight" | "vaccinations";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "weight", label: "Weight History" },
  { id: "vaccinations", label: "Vaccinations" },
];

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: patient, isLoading, error } = trpc.patients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  );

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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
              {speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/patients/${patient.id}/edit`)}
          >
            Edit
          </Button>
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

      {/* Tab Navigation */}
      <div className="mt-6 border-b border-border">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
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
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
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
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Vaccination records coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
