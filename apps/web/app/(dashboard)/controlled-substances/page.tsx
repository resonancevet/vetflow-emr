"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEA_SCHEDULES = [
  { label: "Schedule II", value: "II" },
  { label: "Schedule III", value: "III" },
  { label: "Schedule IV", value: "IV" },
  { label: "Schedule V", value: "V" },
] as const;

const ACTIONS = [
  { label: "Received", value: "received" },
  { label: "Administered", value: "administered" },
  { label: "Wasted", value: "wasted" },
  { label: "Returned", value: "returned" },
] as const;

const UNITS = [
  { label: "mg", value: "mg" },
  { label: "ml", value: "ml" },
  { label: "tablet", value: "tablet" },
  { label: "capsule", value: "capsule" },
  { label: "vial", value: "vial" },
] as const;

const ACTION_STYLES: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  administered: "bg-green-100 text-green-700",
  wasted: "bg-amber-100 text-amber-700",
  returned: "bg-gray-100 text-gray-700",
};

function LogEntryForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createMutation = trpc.controlledSubstances.create.useMutation({
    onSuccess: () => {
      toast.success("Log entry recorded");
      utils.controlledSubstances.list.invalidate();
      utils.controlledSubstances.summary.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    drugName: "",
    deaSchedule: "II",
    action: "received",
    quantity: "",
    unit: "mg",
    patient: "",
    witness: "",
    lotNumber: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.drugName || !form.quantity) return;
    if (form.action === "administered" && !form.patient) {
      toast.error("Patient is required for administered entries");
      return;
    }
    if (form.action === "wasted" && !form.witness) {
      toast.error("Witness is required for wasted entries");
      return;
    }
    createMutation.mutate({
      drugName: form.drugName,
      deaSchedule: form.deaSchedule as "II" | "III" | "IV" | "V",
      action: form.action as "received" | "administered" | "wasted" | "returned",
      quantity: form.quantity,
      unit: form.unit,
      patientId: form.patient || undefined,
      witnessedBy: form.witness || undefined,
      lotNumber: form.lotNumber || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium text-sm">New Log Entry</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Drug Name *
          </label>
          <Input
            placeholder="Drug name"
            value={form.drugName}
            onChange={(e) => setForm({ ...form, drugName: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            DEA Schedule
          </label>
          <select
            value={form.deaSchedule}
            onChange={(e) => setForm({ ...form, deaSchedule: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {DEA_SCHEDULES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Action
          </label>
          <select
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Quantity *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Qty"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Unit
            </label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Patient {form.action === "administered" && "*"}
          </label>
          <Input
            placeholder="Patient name"
            value={form.patient}
            onChange={(e) => setForm({ ...form, patient: e.target.value })}
            required={form.action === "administered"}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Witness {form.action === "wasted" && "*"}
          </label>
          <Input
            placeholder="Witness name"
            value={form.witness}
            onChange={(e) => setForm({ ...form, witness: e.target.value })}
            required={form.action === "wasted"}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Lot Number
          </label>
          <Input
            placeholder="Lot #"
            value={form.lotNumber}
            onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Notes
          </label>
          <Input
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Submitting..." : "Submit Entry"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
      {createMutation.error && (
        <p className="text-sm text-destructive">
          {createMutation.error.message}
        </p>
      )}
    </form>
  );
}

function SummarySection() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = trpc.controlledSubstances.summary.useQuery({});

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
      >
        <span>Drug Balance Summary</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading summary...
            </div>
          ) : data && data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground">
                      Drug
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Received
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Administered
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Wasted
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Returned
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Net Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((drug) => (
                    <tr
                      key={drug.drugName}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 font-medium">{drug.drugName}</td>
                      <td className="py-2 text-right tabular-nums text-blue-600">
                        {drug.totalReceived}
                      </td>
                      <td className="py-2 text-right tabular-nums text-green-600">
                        {drug.totalAdministered}
                      </td>
                      <td className="py-2 text-right tabular-nums text-amber-600">
                        {drug.totalWasted}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-600">
                        {drug.totalReturned}
                      </td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {(Number(drug.totalReceived) - Number(drug.totalAdministered) - Number(drug.totalWasted) - Number(drug.totalReturned)).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ControlledSubstancesPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const { data, isLoading, error } =
    trpc.controlledSubstances.list.useQuery({
      drugName: search || undefined,
      limit,
      offset,
    });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Controlled Substance Log
          </h2>
          <p className="text-sm text-muted-foreground">
            DEA-required tracking for scheduled drugs
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Log Entry
        </Button>
      </div>

      {showForm && <LogEntryForm onClose={() => setShowForm(false)} />}

      {/* Summary Section */}
      <div className="mt-6">
        <SummarySection />
      </div>

      {/* Search / Filter */}
      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by drug name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 text-center text-muted-foreground">
          Loading...
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date/Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Drug Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Qty/Unit
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Performed By
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Witness
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {entry.performedAt
                        ? new Date(entry.performedAt).toLocaleString()
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.drugName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.deaSchedule}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          ACTION_STYLES[entry.action] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.quantity} {entry.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.patientName || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.performerName || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.witnessName || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {entry.notes || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {offset + 1}--{Math.min(offset + limit, data.total)} of{" "}
              {data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= data.total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            {search
              ? "No entries match your filter"
              : "No controlled substance entries yet"}
          </p>
        </div>
      )}
    </div>
  );
}
