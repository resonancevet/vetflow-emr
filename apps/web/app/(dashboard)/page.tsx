"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  PawPrint,
  FileText,
  Clock,
  History,
  Phone,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useRecentPatients, pruneRecentPatients } from "@/lib/recent-patients";
import { Button } from "@/components/ui/button";
import {
  ApproveAppointmentRequestModal,
  DeclineAppointmentRequestModal,
} from "@/components/dashboard/appointment-request-modals";
import { useCallbackPanel } from "@/components/dashboard/callback-panel-context";
import { formatPhoneDisplay } from "@/lib/phone-format";

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

type RequestActionTarget = {
  id: string;
  patientId: string | null;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientBreed: string | null;
  patientSex: string | null;
  patientDob: string | Date | null;
  preferredDate: string | null;
  preferredTime: string | null;
  reason: string | null;
  clientEmail: string | null;
  needsCallback: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const { openCallback } = useCallbackPanel();
  const stats = trpc.dashboard.getStats.useQuery();
  const requests = trpc.dashboard.listAppointmentRequests.useQuery();
  const [approveTarget, setApproveTarget] = useState<RequestActionTarget | null>(
    null
  );
  const [declineTarget, setDeclineTarget] = useState<RequestActionTarget | null>(
    null
  );

  const recentPatients = useRecentPatients();

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

  const pendingRequests = requests.data ?? [];

  return (
    <div className="space-y-8">
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

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Appointment requests
            </h2>
            <p className="text-xs text-muted-foreground">
              From the pet portal — approve to schedule, or mark for callback /
              decline if the slot isn&apos;t available.
            </p>
          </div>
          {(stats.data?.pendingAppointmentRequests ?? 0) > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              {stats.data?.pendingAppointmentRequests} open
            </span>
          )}
        </div>
        <div className="space-y-2 p-4">
          {requests.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <AppointmentRowSkeleton key={i} />
            ))
          ) : requests.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              {requests.error.message}
            </p>
          ) : pendingRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open appointment requests.
            </p>
          ) : (
            pendingRequests.map((req) => {
              const actionTarget: RequestActionTarget = {
                id: req.id,
                patientId: req.patientId,
                clientId: req.clientId,
                clientName: req.clientName,
                clientPhone: req.clientPhone,
                patientName: req.patientName,
                patientSpecies: req.patientSpecies,
                patientBreed: req.patientBreed,
                patientSex: req.patientSex,
                patientDob: req.patientDob,
                preferredDate: req.preferredDate,
                preferredTime: req.preferredTime,
                reason: req.reason,
                clientEmail: req.clientEmail,
                needsCallback: req.needsCallback,
              };
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-md border border-border px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {req.patientName ?? "Pet"}
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({req.clientName || "Client"})
                        </span>
                      </p>
                      {req.needsCallback && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Needs callback
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Preferred:{" "}
                      {[req.preferredDate, req.preferredTime]
                        .filter(Boolean)
                        .join(" · ") || "not specified"}
                      {req.reason ? ` — ${req.reason}` : ""}
                    </p>
                    {req.clientPhone && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatPhoneDisplay(req.clientPhone)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      onClick={() => setApproveTarget(actionTarget)}
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={() => openCallback(actionTarget)}
                    >
                      <Phone className="mr-1.5 h-4 w-4" />
                      {req.needsCallback ? "Log call" : "Call back"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      onClick={() => setDeclineTarget(actionTarget)}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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

      <ApproveAppointmentRequestModal
        request={approveTarget}
        onClose={() => setApproveTarget(null)}
      />
      <DeclineAppointmentRequestModal
        request={declineTarget}
        onClose={() => setDeclineTarget(null)}
      />
    </div>
  );
}
