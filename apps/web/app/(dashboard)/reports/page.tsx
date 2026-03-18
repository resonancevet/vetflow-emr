"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  CalendarCheck,
  UserX,
  XCircle,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle,
  Activity,
  BarChart3,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tab = "revenue" | "appointments" | "services" | "inventory";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "revenue", label: "Revenue", icon: DollarSign },
  { key: "appointments", label: "Appointments", icon: CalendarCheck },
  { key: "services", label: "Services", icon: BarChart3 },
  { key: "inventory", label: "Inventory", icon: Package },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function RevenueTab() {
  const { data, isLoading } = trpc.reports.revenue.useQuery();

  if (isLoading || !data) return <LoadingSkeleton />;

  const diff = data.lastMonth > 0
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : data.thisMonth > 0
      ? 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="This Month"
          value={formatCurrency(data.thisMonth)}
          subtitle={
            diff !== 0
              ? `${diff > 0 ? "+" : ""}${diff}% vs last month`
              : undefined
          }
          icon={DollarSign}
        />
        <KpiCard
          title="Last Month"
          value={formatCurrency(data.lastMonth)}
          icon={TrendingUp}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Daily Revenue (Last 30 Days)
        </h3>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#0d9488"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            No revenue data for this period
          </p>
        )}
      </div>
    </div>
  );
}

function AppointmentsTab() {
  const { data, isLoading } = trpc.reports.appointments.useQuery();

  if (isLoading || !data) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total" value={String(data.total)} icon={CalendarCheck} />
        <KpiCard
          title="Completed"
          value={String(data.completed)}
          icon={CheckCircle}
        />
        <KpiCard title="No-Shows" value={String(data.noShows)} icon={UserX} />
        <KpiCard
          title="Cancellations"
          value={String(data.cancelled)}
          icon={XCircle}
        />
      </div>

      {/* Fill rate */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Fill Rate
          </h3>
          <span className="text-lg font-semibold">{data.fillRate}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${Math.min(data.fillRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Doctor breakdown */}
      {data.byDoctor.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Doctor Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Completed</th>
                  <th className="pb-2 font-medium text-right">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.byDoctor.map((doc) => (
                  <tr key={doc.doctorName} className="border-b border-border last:border-0">
                    <td className="py-2">{doc.doctorName}</td>
                    <td className="py-2 text-right">{doc.total}</td>
                    <td className="py-2 text-right">{doc.completed}</td>
                    <td className="py-2 text-right">
                      {doc.total > 0
                        ? Math.round((doc.completed / doc.total) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ServicesTab() {
  const { data, isLoading } = trpc.reports.topServices.useQuery();

  if (isLoading || !data) return <LoadingSkeleton />;

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">No service data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Top 10 Services by Count
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
            />
            <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Service Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium text-right">Count</th>
                <th className="pb-2 font-medium text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((svc) => (
                <tr key={svc.name} className="border-b border-border last:border-0">
                  <td className="py-2">{svc.name}</td>
                  <td className="py-2 text-right">{svc.count}</td>
                  <td className="py-2 text-right">{formatCurrency(svc.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InventoryTab() {
  const { data, isLoading } = trpc.reports.inventoryAlerts.useQuery();

  if (isLoading || !data) return <LoadingSkeleton />;

  const hasAlerts = data.lowStock.length > 0 || data.expiring.length > 0;

  if (!hasAlerts) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950/30">
        <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-600 dark:text-green-400" />
        <p className="font-medium text-green-800 dark:text-green-300">
          All stock levels OK
        </p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-400">
          No low stock or expiring products detected
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Low Stock Alerts */}
      {data.lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Low Stock Alerts ({data.lowStock.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-200 text-left text-amber-700 dark:border-amber-800 dark:text-amber-400">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium text-right">Stock</th>
                  <th className="pb-2 font-medium text-right">Reorder Point</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((item) => (
                  <tr
                    key={item.sku ?? item.name}
                    className="border-b border-amber-100 last:border-0 dark:border-amber-900"
                  >
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-muted-foreground">{item.sku ?? "-"}</td>
                    <td className="py-2 text-right font-medium">{item.stockQuantity}</td>
                    <td className="py-2 text-right">{item.reorderPoint ?? 10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expiring Soon */}
      {data.expiring.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-5 dark:border-red-900 dark:bg-red-950/20">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
              Expiring Soon ({data.expiring.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200 text-left text-red-700 dark:border-red-800 dark:text-red-400">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 font-medium text-right">Stock</th>
                  <th className="pb-2 font-medium text-right">Expiration Date</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring.map((item) => (
                  <tr
                    key={item.sku ?? item.name}
                    className="border-b border-red-100 last:border-0 dark:border-red-900"
                  >
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-muted-foreground">{item.sku ?? "-"}</td>
                    <td className="py-2 text-right">{item.stockQuantity}</td>
                    <td className="py-2 text-right font-medium">{item.expirationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("revenue");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Practice analytics and insights
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 gap-2",
                activeTab === tab.key
                  ? ""
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "revenue" && <RevenueTab />}
        {activeTab === "appointments" && <AppointmentsTab />}
        {activeTab === "services" && <ServicesTab />}
        {activeTab === "inventory" && <InventoryTab />}
      </div>
    </div>
  );
}
