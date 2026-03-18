"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const speciesEmoji: Record<string, string> = {
  canine: "🐶",
  feline: "🐱",
  avian: "🐦",
  rabbit: "🐇",
  reptile: "🦎",
  equine: "🐴",
  other: "🐾",
};

function calculateAge(dob: string | null): string {
  if (!dob) return "Unknown age";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? "s" : ""} old`;
  const y = Math.floor(totalMonths / 12);
  return `${y} year${y !== 1 ? "s" : ""} old`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Tab = "vaccinations" | "prescriptions" | "weights";

export default function PetDetailPage() {
  const params = useParams();
  const token = params.token as string;
  const petId = params.petId as string;
  const [activeTab, setActiveTab] = useState<Tab>("vaccinations");

  const { data, isLoading, error } = trpc.portal.getPetDetail.useQuery({
    token,
    patientId: petId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">Unable to load pet information.</p>
        <Link href={`/portal/${token}`} className="text-teal-600 underline mt-2 inline-block">
          Back to portal
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "vaccinations", label: "Vaccinations", count: data.vaccinations.length },
    { key: "prescriptions", label: "Prescriptions", count: data.prescriptions.length },
    { key: "weights", label: "Weight History", count: data.weights.length },
  ];

  function vaccinationStatus(nextDue: string | null): {
    label: string;
    className: string;
  } {
    if (!nextDue) return { label: "No due date", className: "bg-gray-100 text-gray-600" };
    const due = new Date(nextDue);
    const now = new Date();
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { label: "Overdue", className: "bg-red-100 text-red-700" };
    if (daysUntil <= 30) return { label: "Due soon", className: "bg-amber-100 text-amber-700" };
    return { label: "Up to date", className: "bg-green-100 text-green-700" };
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/portal/${token}`}
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to all pets
      </Link>

      {/* Pet Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center text-3xl flex-shrink-0">
          {speciesEmoji[data.species] || "🐾"}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <p className="text-gray-500">
            {data.breed || data.species} &middot; {data.color || ""} &middot;{" "}
            {calculateAge(data.dob)}
          </p>
          <p className="text-sm text-gray-400 capitalize">
            {data.sex?.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Allergy Alerts */}
      {data.allergies.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Allergy Alerts
          </h3>
          <ul className="space-y-1">
            {data.allergies.map((a) => (
              <li key={a.id} className="text-sm text-red-700">
                <span className="font-medium">{a.allergen}</span>
                {a.reaction && <span className="text-red-600"> - {a.reaction}</span>}
                <span
                  className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                    a.severity === "severe"
                      ? "bg-red-200 text-red-800"
                      : a.severity === "moderate"
                      ? "bg-amber-200 text-amber-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {a.severity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Vaccinations Tab */}
      {activeTab === "vaccinations" && (
        <div>
          {data.vaccinations.length === 0 ? (
            <p className="text-gray-400 py-8 text-center">No vaccination records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Vaccine</th>
                    <th className="pb-2 font-medium">Given</th>
                    <th className="pb-2 font-medium">Next Due</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.vaccinations.map((v) => {
                    const status = vaccinationStatus(v.nextDueDate);
                    return (
                      <tr key={v.id}>
                        <td className="py-3 font-medium text-gray-900">{v.vaccineName}</td>
                        <td className="py-3 text-gray-600">{formatDate(v.administeredAt)}</td>
                        <td className="py-3 text-gray-600">{formatDate(v.nextDueDate)}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prescriptions Tab */}
      {activeTab === "prescriptions" && (
        <div>
          {data.prescriptions.length === 0 ? (
            <p className="text-gray-400 py-8 text-center">No active prescriptions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 font-medium">Medication</th>
                    <th className="pb-2 font-medium">Dosage</th>
                    <th className="pb-2 font-medium">Frequency</th>
                    <th className="pb-2 font-medium">Refills</th>
                    <th className="pb-2 font-medium">End Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.prescriptions.map((rx) => (
                    <tr key={rx.id}>
                      <td className="py-3 font-medium text-gray-900">{rx.medicationName}</td>
                      <td className="py-3 text-gray-600">{rx.dosage}</td>
                      <td className="py-3 text-gray-600">{rx.frequency}</td>
                      <td className="py-3 text-gray-600">{rx.refillsRemaining}</td>
                      <td className="py-3 text-gray-600">{formatDate(rx.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.prescriptions.some((rx) => rx.instructions) && (
                <div className="mt-4 space-y-2">
                  {data.prescriptions
                    .filter((rx) => rx.instructions)
                    .map((rx) => (
                      <div key={rx.id} className="rounded-lg bg-blue-50 p-3 text-sm">
                        <span className="font-medium text-blue-900">{rx.medicationName}:</span>{" "}
                        <span className="text-blue-700">{rx.instructions}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Weight History Tab */}
      {activeTab === "weights" && (
        <div>
          {data.weights.length === 0 ? (
            <p className="text-gray-400 py-8 text-center">No weight records yet.</p>
          ) : (
            <div className="space-y-3">
              {data.weights.map((w, i) => {
                const prevWeight =
                  i < data.weights.length - 1
                    ? parseFloat(data.weights[i + 1]!.weightKg)
                    : null;
                const currentWeight = parseFloat(w.weightKg);
                const diff = prevWeight !== null ? currentWeight - prevWeight : null;
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {currentWeight.toFixed(1)} kg
                        <span className="ml-1 text-gray-400 text-sm">
                          ({(currentWeight * 2.205).toFixed(1)} lbs)
                        </span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(w.recordedAt)}
                      </p>
                    </div>
                    {diff !== null && (
                      <span
                        className={`text-sm font-medium ${
                          diff > 0
                            ? "text-green-600"
                            : diff < 0
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)} kg
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
