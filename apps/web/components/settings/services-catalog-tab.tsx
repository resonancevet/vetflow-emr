"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SERVICE_CATEGORIES = [
  "Exam",
  "Vaccine",
  "Lab",
  "Diagnostic",
  "Dental",
  "Surgery",
  "Hospitalization",
  "Grooming",
  "Misc",
] as const;

type ServiceDraft = {
  name: string;
  code: string;
  category: string;
  defaultPrice: string;
  taxable: boolean;
};

const emptyDraft = (): ServiceDraft => ({
  name: "",
  code: "",
  category: "",
  defaultPrice: "",
  taxable: true,
});

function formatPrice(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function ServicesCatalogTab() {
  const utils = trpc.useUtils();
  const { data: services, isLoading } = trpc.billing.listServices.useQuery();
  const billingSettings = trpc.settings.getBillingSettings.useQuery();
  const taxEnabled = billingSettings.data?.taxEnabled ?? true;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyDraft());

  const createService = trpc.billing.createService.useMutation({
    onSuccess: () => {
      toast.success("Service saved");
      utils.billing.listServices.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateService = trpc.billing.updateService.useMutation({
    onSuccess: () => {
      toast.success("Service updated");
      utils.billing.listServices.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteService = trpc.billing.deleteService.useMutation({
    onSuccess: () => {
      toast.success("Service removed");
      utils.billing.listServices.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const categories = useMemo(() => {
    const fromCatalog = (services ?? [])
      .map((service) => service.category)
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set([...SERVICE_CATEGORIES, ...fromCatalog])).sort();
  }, [services]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  }

  function startEdit(service: NonNullable<typeof services>[number]) {
    setEditingId(service.id);
    setShowForm(true);
    setDraft({
      name: service.name,
      code: service.code ?? "",
      category: service.category ?? "",
      defaultPrice: service.defaultPrice,
      taxable: service.taxable,
    });
  }

  function save() {
    if (!draft.name.trim()) {
      toast.error("Service name is required");
      return;
    }
    const price = parseFloat(draft.defaultPrice.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price");
      return;
    }
    const payload = {
      name: draft.name.trim(),
      code: draft.code.trim() || null,
      category: draft.category.trim() || null,
      defaultPrice: price.toFixed(2),
      ...(taxEnabled ? { taxable: draft.taxable } : {}),
    };
    if (editingId) {
      updateService.mutate({ id: editingId, ...payload });
    } else {
      createService.mutate(payload);
    }
  }

  const saving = createService.isPending || updateService.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Services catalog</h3>
          <p className="text-xs text-muted-foreground">
            Fee schedule used when adding a service line on an invoice or
            estimate.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add service
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {editingId ? "Edit service" : "New service"}
            </h4>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Name</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Wellness exam"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Code</label>
              <Input
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                placeholder="e.g. EXAM-01"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Category</label>
              <Input
                list="service-category-options"
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
                placeholder="e.g. Exam"
              />
              <datalist id="service-category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Price</label>
              <Input
                inputMode="decimal"
                value={draft.defaultPrice}
                onChange={(e) =>
                  setDraft({ ...draft, defaultPrice: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
            {taxEnabled && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.taxable}
                    onChange={(e) =>
                      setDraft({ ...draft, taxable: e.target.checked })
                    }
                  />
                  Taxable
                </label>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Save service"}
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Service</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Code</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              {taxEnabled && (
                <th className="px-4 py-3 text-left font-medium">Tax</th>
              )}
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(services ?? []).map((service) => (
              <tr
                key={service.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{service.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {service.category || "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {service.code || "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPrice(service.defaultPrice)}
                </td>
                {taxEnabled && (
                  <td className="px-4 py-3 text-muted-foreground">
                    {service.taxable ? "Taxable" : "Exempt"}
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(service)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove ${service.name}?`)) {
                          deleteService.mutate({ id: service.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(!services || services.length === 0) && (
              <tr>
                <td
                  colSpan={taxEnabled ? 6 : 5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No services yet. Add exams, surgeries, labs, and other fees
                  here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
