"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, PawPrint, FileText, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useRecentPatients, pruneRecentPatients } from "@/lib/recent-patients";

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const kpiConfig = [
  {
    key: "todayAppointments" as const,
    label: "Today's Appointments",
    description: "Scheduled for today",
    icon: Calendar,
    format: (v: number) => String(v),
  },
  {
    key: "patientsSeen" as const,
    label: "Patients Seen Today",
    description: "Checked out today",
    icon: PawPrint,
    format: (v: number) => String(v),
  },
  {
    key: "pendingInvoices" as const,
    label: "Pending Invoices",
    description: "Sent or overdue",
    icon: FileText,
    format: (v: number) => String(v),
  },
] as const;

function KpiCard({
  label,
  description,
  value,
  icon: Icon,
}: {
  label: string;
  description: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-2 h-3 w-32 rounded bg-muted" />
    </div>
  );
}

function AppointmentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-md border border-border p-3 animate-pulse">
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="ml-auto h-5 w-20 rounded-full bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const stats = trpc.dashboard.getStats.useQuery();

  const recentPatients = useRecentPatients();

  // Validate the per-browser recent list against the current practice and drop
  // stale entries (e.g. demo patients from another practice or deleted records).
  const recentIds = useMemo(
    () => recentPatients.map((p) => p.id),
    [recentPatients]
  );
  const { data: validRecent } = trpc.patients.filterExisting.useQuery(
    { ids: recentIds },
    { enabled: recentIds.length > 0 }
  );
  useEffect(() => {
    if (validRecent) {
      pruneRecentPatients(validRecent.ids);
    }
  }, [validRecent]);

  const recentlyViewed = recentPatients.slice(0, 5);

  const scheduleHours = trpc.appointments.getScheduleHours.useQuery();
  const endHour = scheduleHours.data?.endHour ?? 18;

  const now = new Date();
  // Once the clinic's configured end-of-day has passed, the rest of today's
  // schedule is over, so surface tomorrow's appointments instead.
  const showNextDay = now.getHours() >= endHour;

  const toDateStr = (offsetDays: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
      .toISOString()
      .slice(0, 10);

  const dayOffset = showNextDay ? 1 : 0;

  const upcoming = trpc.appointments.list.useQuery({
    startDate: toDateStr(dayOffset),
    endDate: toDateStr(dayOffset + 1),
  });

  const upcomingAppointments = (upcoming.data ?? [])
    .filter(
      (a) =>
        a.status !== "checked_out" &&
        a.status !== "cancelled" &&
        a.status !== "no_show"
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* KPI Cards + Recently Viewed */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            {kpiConfig.slice(0, 2).map((kpi) => (
              <KpiCard
                key={kpi.key}
                label={kpi.label}
                description={kpi.description}
                value={kpi.format(stats.data?.[kpi.key] ?? 0)}
                icon={kpi.icon}
              />
            ))}

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <History className="h-5 w-5" />
                </div>
                <p className="text-sm text-muted-foreground">Recently Viewed</p>
              </div>
              {recentlyViewed.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No patients viewed yet.
                </p>
              ) : (
                <ul className="space-y-1">
                  {recentlyViewed.map((p) => {
                    const owner = [p.clientFirstName, p.clientLastName]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/patients/${p.id}`)}
                          className="w-full truncate rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-muted/60"
                        >
                          <span className="font-medium text-foreground">
                            {p.name}
                          </span>
                          {owner && (
                            <span className="text-muted-foreground">
                              {" "}
                              {owner}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <KpiCard
              label={kpiConfig[2].label}
              description={kpiConfig[2].description}
              value={kpiConfig[2].format(
                stats.data?.[kpiConfig[2].key] ?? 0
              )}
              icon={kpiConfig[2].icon}
            />
          </>
        )}
      </div>

      {/* Upcoming Appointments */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-lg font-semibold">
            {showNextDay ? "Tomorrow's Appointments" : "Upcoming Appointments"}
          </h2>
        </div>
        <div className="space-y-2 p-4">
          {upcoming.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <AppointmentRowSkeleton key={i} />
            ))
          ) : upcomingAppointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {showNextDay
                ? "No appointments scheduled for tomorrow."
                : "No upcoming appointments today."}
            </p>
          ) : (
            upcomingAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center gap-4 rounded-md border border-border px-4 py-3"
              >
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatTime(appt.startTime)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {appt.patientName ?? "Unknown Patient"}
                    {appt.clientLastName && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({appt.clientFirstName} {appt.clientLastName})
                      </span>
                    )}
                  </p>
                  {appt.typeName && (
                    <p className="text-xs text-muted-foreground">
                      {appt.typeName}
                      {appt.doctorName ? ` with ${appt.doctorName}` : ""}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                    appt.status === "confirmed"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : appt.status === "checked_in"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : appt.status === "in_exam"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  {appt.status.replace("_", " ")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
