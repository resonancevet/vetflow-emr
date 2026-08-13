"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProductPicker,
  type CatalogProduct,
} from "@/components/inventory/product-picker";
import {
  DUE_INTERVAL_UNITS,
  formatDueInterval,
  type DueIntervalUnit,
} from "@/lib/due-interval";
import { kitKindLabel, type KitKind } from "@/lib/kit-kind";

type KitItemDraft = {
  product: CatalogProduct | null;
  quantity: number;
  note: string;
};

const emptyItem = (): KitItemDraft => ({
  product: null,
  quantity: 1,
  note: "",
});

export function InventoryKitsTab() {
  const utils = trpc.useUtils();
  const { data: kits, isLoading } = trpc.inventoryKits.list.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<KitKind>("vaccine");
  const [planName, setPlanName] = useState("");
  const [items, setItems] = useState<KitItemDraft[]>([emptyItem()]);
  const [showProtocol, setShowProtocol] = useState(false);
  const [dueIntervalValue, setDueIntervalValue] = useState("");
  const [dueIntervalUnit, setDueIntervalUnit] =
    useState<DueIntervalUnit>("years");

  const createKit = trpc.inventoryKits.create.useMutation({
    onSuccess: () => {
      toast.success("Inventory kit saved");
      utils.inventoryKits.list.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateKit = trpc.inventoryKits.update.useMutation({
    onSuccess: () => {
      toast.success("Inventory kit updated");
      utils.inventoryKits.list.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteKit = trpc.inventoryKits.delete.useMutation({
    onSuccess: () => {
      toast.success("Inventory kit removed");
      utils.inventoryKits.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleActive = trpc.inventoryKits.update.useMutation({
    onSuccess: () => utils.inventoryKits.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setKind("vaccine");
    setPlanName("");
    setItems([emptyItem()]);
    setShowProtocol(false);
    setDueIntervalValue("");
    setDueIntervalUnit("years");
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(kit: NonNullable<typeof kits>[number]) {
    setEditingId(kit.id);
    setShowForm(true);
    setName(kit.name);
    setKind(kit.kind === "lab" ? "lab" : "vaccine");
    setPlanName(kit.planName ?? "");
    setItems(
      kit.items.length > 0
        ? kit.items.map((item) => ({
            product: {
              id: item.productId,
              name: item.productName,
              sku: item.productSku,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice,
              stockQuantity: item.stockQuantity,
              units: item.units,
              category: item.category,
              lotNumber: item.productLotNumber,
              planName: item.productPlanName,
            },
            quantity: item.quantity,
            note: item.note ?? "",
          }))
        : [emptyItem()]
    );
    const hasProtocol = Boolean(
      kit.dueIntervalValue && kit.dueIntervalUnit
    );
    setShowProtocol(hasProtocol);
    setDueIntervalValue(
      kit.dueIntervalValue ? String(kit.dueIntervalValue) : ""
    );
    setDueIntervalUnit(
      kit.dueIntervalUnit === "days" ||
        kit.dueIntervalUnit === "weeks" ||
        kit.dueIntervalUnit === "months" ||
        kit.dueIntervalUnit === "years"
        ? kit.dueIntervalUnit
        : "years"
    );
  }

  function save() {
    const validItems = items.filter((item) => item.product);
    if (!name.trim()) {
      toast.error("Kit name is required");
      return;
    }
    if (validItems.length === 0) {
      toast.error("Add at least one inventory item");
      return;
    }
    const interval = Number(dueIntervalValue);
    const hasProtocol =
      kind === "vaccine" && Number.isFinite(interval) && interval >= 1;
    const payload = {
      name: name.trim(),
      kind,
      planName: planName.trim() || null,
      dueIntervalValue: hasProtocol ? interval : null,
      dueIntervalUnit: hasProtocol ? dueIntervalUnit : null,
      items: validItems.map((item, index) => ({
        productId: item.product!.id,
        quantity: item.quantity,
        note: item.note.trim() || undefined,
        sortOrder: index,
      })),
    };
    if (editingId) {
      updateKit.mutate({ id: editingId, ...payload });
    } else {
      createKit.mutate(payload);
    }
  }

  const saving = createKit.isPending || updateKit.isPending;

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
          <h3 className="text-sm font-semibold">Inventory kits</h3>
          <p className="text-xs text-muted-foreground">
            Bundles deducted from inventory together. Tag as Vaccine or Lab so
            they only appear under + Vaccine or + Lab test.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add kit
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {editingId ? "Edit kit" : "New kit"}
            </h4>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Kit name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rabies canine"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Type</label>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value === "lab" ? "lab" : "vaccine")
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="vaccine">Vaccine</option>
              <option value="lab">Lab</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Vaccine kits show on + Vaccine. Lab kits show on + Lab test.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Plan name</label>
            <Input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. Rabies"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              How this appears in the SOAP plan. Leave blank to use the
              inventory name.
            </p>
          </div>

          {kind === "vaccine" && (
          <div className="rounded-md border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
              onClick={() => {
                setShowProtocol((open) => {
                  if (!open && !dueIntervalValue) setDueIntervalValue("1");
                  return !open;
                });
              }}
            >
              <span>Due date protocol</span>
              {showProtocol ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showProtocol && (
              <div className="space-y-2 border-t border-border px-3 py-3">
                <p className="text-xs text-muted-foreground">
                  Optional. Automatically calculates the next vaccine due date
                  from the date given.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Interval
                    </label>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={dueIntervalValue}
                      onChange={(e) => setDueIntervalValue(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
                      Unit
                    </label>
                    <select
                      value={dueIntervalUnit}
                      onChange={(e) =>
                        setDueIntervalUnit(e.target.value as DueIntervalUnit)
                      }
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {DUE_INTERVAL_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit.charAt(0).toUpperCase() + unit.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDueIntervalValue("");
                      setDueIntervalUnit("years");
                      setShowProtocol(false);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Inventory items</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add item
              </Button>
            </div>
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,8rem)_auto] sm:items-end"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Product
                  </label>
                  <ProductPicker
                    value={item.product}
                    placeholder="Search vaccine, syringe, needle..."
                    onChange={(product) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, product } : row
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Note</label>
                  <Input
                    value={item.note}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, note: e.target.value } : row
                        )
                      )
                    }
                    placeholder="optional"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setItems((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Save kit"}
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
              <th className="px-4 py-3 text-left font-medium">Kit</th>
              <th className="px-4 py-3 text-left font-medium">Items</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(kits ?? []).map((kit) => (
              <tr key={kit.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{kit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kitKindLabel(kit.kind)} ·{" "}
                    {kit.isActive ? "Active" : "Inactive"}
                    {kit.planName ? ` · Plan: ${kit.planName}` : ""}
                    {formatDueInterval(
                      kit.dueIntervalValue,
                      kit.dueIntervalUnit
                    )
                      ? ` · Due in ${formatDueInterval(
                          kit.dueIntervalValue,
                          kit.dueIntervalUnit
                        )}`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {kit.items
                    .map((item) => `${item.quantity}× ${item.productName}`)
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(kit)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        toggleActive.mutate({
                          id: kit.id,
                          isActive: !kit.isActive,
                        })
                      }
                    >
                      {kit.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remove this inventory kit?")) {
                          deleteKit.mutate({ id: kit.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(!kits || kits.length === 0) && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No inventory kits yet. Add one to deduct several products at
                  once.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
