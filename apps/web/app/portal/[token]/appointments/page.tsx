"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  confirmed: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  checked_in: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  in_exam: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  checked_out: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  no_show: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
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
        <p className="text-lg text-muted-foreground">Unable to load appointments.</p>
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
        className="mb-6 inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to portal
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">Appointments</h1>

      {/* Upcoming */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-50 dark:bg-teal-950/400" />
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-border p-4 hover:border-teal-300 dark:hover:border-teal-700 dark:border-teal-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {formatDateTime(appt.startTime)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {appt.patientSpecies && (
                        <span className="mr-1">{speciesEmoji[appt.patientSpecies] || "🐾"}</span>
                      )}
                      {appt.patientName || "No patient"}
                      {appt.typeName && (
                        <span className="text-muted-foreground"> &middot; {appt.typeName}</span>
                      )}
                    </p>
                    {appt.doctorName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        with {appt.doctorName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                      statusStyles[appt.status] || "bg-muted text-muted-foreground"
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
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
          Past
        </h2>
        {past.length === 0 ? (
          <p className="text-muted-foreground text-sm">No past appointments.</p>
        ) : (
          <div className="space-y-3">
            {past.map((appt) => (
              <div
                key={appt.id}
                className="rounded-xl border border-border p-4 bg-muted/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground/90">
                      {formatDateTime(appt.startTime)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {appt.patientSpecies && (
                        <span className="mr-1">{speciesEmoji[appt.patientSpecies] || "🐾"}</span>
                      )}
                      {appt.patientName || "No patient"}
                      {appt.typeName && (
                        <span className="text-muted-foreground"> &middot; {appt.typeName}</span>
                      )}
                    </p>
                    {appt.doctorName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        with {appt.doctorName}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                      statusStyles[appt.status] || "bg-muted text-muted-foreground"
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
