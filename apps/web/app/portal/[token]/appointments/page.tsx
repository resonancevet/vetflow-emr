"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-teal-100 text-teal-700",
  checked_in: "bg-amber-100 text-amber-700",
  in_exam: "bg-purple-100 text-purple-700",
  checked_out: "bg-green-100 text-green-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const speciesEmoji: Record<string, string> = {
  canine: "🐶",
  feline: "🐱",
  avian: "🐦",
  rabbit: "🐇",
  reptile: "🦎",
  equine: "🐴",
  other: "🐾",
};

function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AppointmentsPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = trpc.portal.getAppointments.useQuery({ token });

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
        <p className="text-lg text-gray-500">Unable to load appointments.</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = (data || []).filter((a) => new Date(a.startTime) >= now && a.status !== "cancelled");
  const past = (data || []).filter((a) => new Date(a.startTime) < now || a.status === "cancelled");

  return (
    <div>
      <Link
        href={`/portal/${token}`}
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to portal
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Appointments</h1>

      {/* Upcoming */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-400 text-sm">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-gray-200 p-4 hover:border-teal-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatDateTime(appt.startTime)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {appt.patientSpecies && (
                        <span className="mr-1">{speciesEmoji[appt.patientSpecies] || "🐾"}</span>
                      )}
                      {appt.patientName || "No patient"}
                      {appt.typeName && (
                        <span className="text-gray-400"> &middot; {appt.typeName}</span>
                      )}
                    </p>
                    {appt.doctorName && (
                      <p className="text-sm text-gray-400 mt-0.5">
                        with {appt.doctorName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                      statusStyles[appt.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatStatusLabel(appt.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gray-400" />
          Past
        </h2>
        {past.length === 0 ? (
          <p className="text-gray-400 text-sm">No past appointments.</p>
        ) : (
          <div className="space-y-3">
            {past.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-gray-100 p-4 bg-gray-50/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-700">
                      {formatDateTime(appt.startTime)}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {appt.patientSpecies && (
                        <span className="mr-1">{speciesEmoji[appt.patientSpecies] || "🐾"}</span>
                      )}
                      {appt.patientName || "No patient"}
                      {appt.typeName && (
                        <span className="text-gray-400"> &middot; {appt.typeName}</span>
                      )}
                    </p>
                    {appt.doctorName && (
                      <p className="text-sm text-gray-400 mt-0.5">
                        with {appt.doctorName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                      statusStyles[appt.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatStatusLabel(appt.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
