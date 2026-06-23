"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, PawPrint, DollarSign, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useRecentPatients, pruneRecentPatients } from "@/lib/recent-patients";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

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
    key: "revenueMtd" as const,
    label: "Revenue (MTD)",
    description: "Paid invoices this month",
    icon: DollarSign,
    format: (v: number) => formatCurrency(v),
  },
  {
    key: "pendingInvoices" as const,
    label: "Pending Invoices",
    description: "Sent or overdue",
    icon: FileText,
    format: (v: number) => String(v),
  },
];

const SPECIES_COLORS: Record<string, string> = {
  Canine: "#3b82f6",
  Feline: "#f59e0b",
  Avian: "#10b981",
  Rabbit: "#8b5cf6",
  Reptile: "#ef4444",
  Equine: "#06b6d4",
  Other: "#6b7280",
};

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

function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
      <div className="mb-4 h-5 w-40 rounded bg-muted" />
      <div className="h-[300px] w-full rounded bg-muted" />
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

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.03) return null;
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      className="text-xs fill-foreground"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const stats = trpc.dashboard.getStats.useQuery();
  const charts = trpc.dashboard.getCharts.useQuery();

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
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpiConfig.map((kpi) => {
              const Icon = kpi.icon;
              const value = stats.data?.[kpi.key] ?? 0;
              return (
                <div
                  key={kpi.key}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {kpi.label}
                      </p>
                      <p className="font-heading text-2xl font-bold">
                        {kpi.format(value)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {kpi.description}
                  </p>
                </div>
              );
            })}
      </div>

      {/* Recently viewed patients */}
      {recentlyViewed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Recently viewed
          </div>
          <div className="flex flex-wrap gap-2">
            {recentlyViewed.map((p) => {
              const owner = [p.clientFirstName, p.clientLastName]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/patients/${p.id}`)}
                  className="flex min-h-[2.5rem] items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="font-medium text-foreground">{p.name}</span>
                  {p.species && (
                    <span className="capitalize text-muted-foreground">
                      {p.species}
                    </span>
                  )}
                  {owner && (
                    <span className="hidden text-muted-foreground sm:inline">
                      &middot; {owner}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Appointments */}
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

      {/* Charts */}
      {charts.isLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <ChartSkeleton />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Appointments This Week - Bar Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold">
                Appointments This Week
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={charts.data?.appointmentsByDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    stackId="a"
                    fill="#22c55e"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="scheduled"
                    name="Scheduled"
                    stackId="a"
                    fill="#3b82f6"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="cancelled"
                    name="Cancelled"
                    stackId="a"
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Species Distribution - Pie Chart */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 font-heading text-lg font-semibold">
                Species Distribution
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={charts.data?.speciesDistribution ?? []}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={PieLabel}
                  >
                    {(charts.data?.speciesDistribution ?? []).map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={SPECIES_COLORS[entry.name] ?? "#6b7280"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Trend - Line Chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 font-heading text-lg font-semibold">
              Revenue (Last 30 Days)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={charts.data?.revenueByDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  className="text-xs fill-muted-foreground"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(value)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#0d9488" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
