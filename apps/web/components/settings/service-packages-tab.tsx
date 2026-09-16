"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitInstallmentAmounts } from "@/lib/service-packages";

type ItemDraft = {
  description: string;
  quantity: number;
};

type FormState = {
  name: string;
  description: string;
  priceTotal: string;
  allowPayInFull: boolean;
  allowMonthly: boolean;
  taxable: boolean;
  isActive: boolean;
  items: ItemDraft[];
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  priceTotal: "",
  allowPayInFull: true,
  allowMonthly: true,
  taxable: true,
  isActive: true,
  items: [{ description: "", quantity: 1 }],
});

function formatMoney(value: string | number) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function ServicePackagesTab() {
  const utils = trpc.useUtils();
  const { data: packages, isLoading } = trpc.servicePackages.listPackages.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const createPackage = trpc.servicePackages.createPackage.useMutation({
    onSuccess: () => {
      toast.success("Package saved");
      utils.servicePackages.listPackages.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePackage = trpc.servicePackages.updatePackage.useMutation({
    onSuccess: () => {
      toast.success("Package updated");
      utils.servicePackages.listPackages.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePackage = trpc.servicePackages.deletePackage.useMutation({
    onSuccess: () => {
      toast.success("Package removed");
      utils.servicePackages.listPackages.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(pkg: NonNullable<typeof packages>[number]) {
    setEditingId(pkg.id);
    setShowForm(true);
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      priceTotal: pkg.priceTotal,
      allowPayInFull: pkg.allowPayInFull,
      allowMonthly: pkg.allowMonthly,
      taxable: pkg.taxable,
      isActive: pkg.isActive,
      items:
        pkg.items.length > 0
          ? pkg.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
            }))
          : [{ description: "", quantity: 1 }],
    });
  }

  function save() {
    if (!form.name.trim() || !form.priceTotal) {
      toast.error("Name and price are required");
      return;
    }
    const items = form.items
      .filter((item) => item.description.trim())
      .map((item, sortOrder) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        sortOrder,
      }));
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      priceTotal: form.priceTotal,
      installmentCount: 12,
      allowPayInFull: form.allowPayInFull,
      allowMonthly: form.allowMonthly,
      taxable: form.taxable,
      isActive: form.isActive,
      items,
    };
    if (editingId) {
      updatePackage.mutate({ id: editingId, ...payload });
    } else {
      createPackage.mutate(payload);
    }
  }

  const monthlyPreview =
    form.allowMonthly && parseFloat(form.priceTotal) > 0
      ? splitInstallmentAmounts(parseFloat(form.priceTotal), 12)[0]
      : null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const saving = createPackage.isPending || updatePackage.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Service packages</h3>
          <p className="text-xs text-muted-foreground">
            Bundled care packages with pay-in-full or a 12-month payment plan.
            Memberships can be added later without changing this.
          </p>
        </div>
        {!showForm && (
          <Button
            size="sm"
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setForm(emptyForm());
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add package
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Package name</span>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Annual Wellness Package"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Description</span>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional details for staff"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Total price</span>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={form.priceTotal}
                onChange={(e) =>
                  setForm({ ...form, priceTotal: e.target.value })
                }
              />
              {monthlyPreview && (
                <p className="text-xs text-muted-foreground">
                  12-month plan ≈ {formatMoney(monthlyPreview)} / month
                </p>
              )}
            </label>
            <div className="space-y-2 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowPayInFull}
                  onChange={(e) =>
                    setForm({ ...form, allowPayInFull: e.target.checked })
                  }
                />
                Allow pay in full
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowMonthly}
                  onChange={(e) =>
                    setForm({ ...form, allowMonthly: e.target.checked })
                  }
                />
                Allow 12-month payment plan
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={(e) =>
                    setForm({ ...form, taxable: e.target.checked })
                  }
                />
                Taxable
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Included items (optional)</p>
            {form.items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="What's included"
                  value={item.description}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[index] = { ...item, description: e.target.value };
                    setForm({ ...form, items: next });
                  }}
                />
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...form.items];
                    next[index] = {
                      ...item,
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    };
                    setForm({ ...form, items: next });
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={form.items.length <= 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      items: form.items.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { description: "", quantity: 1 }],
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Add item
            </Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Save package"}
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
              <th className="px-4 py-3 text-left font-medium">Package</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Payment options</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(packages ?? []).map((pkg) => (
              <tr key={pkg.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pkg.isActive ? "Active" : "Inactive"}
                    {pkg.items.length > 0
                      ? ` · ${pkg.items.length} included item${pkg.items.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(pkg.priceTotal)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[
                    pkg.allowPayInFull ? "Pay in full" : null,
                    pkg.allowMonthly ? "12-month plan" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(pkg)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Remove package “${pkg.name}”?`)) {
                          deletePackage.mutate({ id: pkg.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(!packages || packages.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No service packages yet. Add one to sell with pay-in-full or a
                  12-month plan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
