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
import {
  protocolLabel,
  VACCINE_PROTOCOL_OPTIONS,
} from "@/lib/vaccination-due";

type KitItemDraft = {
  itemType: "product" | "service";
  product: CatalogProduct | null;
  serviceId: string;
  quantity: number;
  note: string;
};

const emptyItem = (itemType: "product" | "service" = "product"): KitItemDraft => ({
  itemType,
  product: null,
  serviceId: "",
  quantity: 1,
  note: "",
});

export function InventoryKitsTab() {
  const utils = trpc.useUtils();
  const { data: kits, isLoading } = trpc.inventoryKits.list.useQuery();
  const { data: servicesList } = trpc.billing.listServices.useQuery();
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
  const [isCombo, setIsCombo] = useState(false);
  const [reminderProtocols, setReminderProtocols] = useState<string[]>([]);

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
    setIsCombo(false);
    setReminderProtocols([]);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function toggleReminder(key: string) {
    setReminderProtocols((prev) => {
      if (isCombo) {
        return prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key];
      }
      return prev.includes(key) ? [] : [key];
    });
  }

  function startEdit(kit: NonNullable<typeof kits>[number]) {
    setEditingId(kit.id);
    setShowForm(true);
    setName(kit.name);
    setKind(kit.kind === "lab" ? "lab" : "vaccine");
    setPlanName(kit.planName ?? "");
    setItems(
      kit.items.length > 0
        ? kit.items.map((item) =>
            item.itemType === "service"
              ? {
                  itemType: "service" as const,
                  product: null,
                  serviceId: item.serviceId ?? "",
                  quantity: item.quantity,
                  note: item.note ?? "",
                }
              : {
                  itemType: "product" as const,
                  product: item.productId
                    ? {
                        id: item.productId,
                        name: item.productName ?? "Product",
                        sku: item.productSku,
                        unitPrice: item.unitPrice ?? "0.00",
                        costPrice: item.costPrice,
                        stockQuantity: item.stockQuantity ?? 0,
                        units: item.units,
                        category: item.category,
                        lotNumber: item.productLotNumber,
                        planName: item.productPlanName,
                      }
                    : null,
                  serviceId: "",
                  quantity: item.quantity,
                  note: item.note ?? "",
                }
          )
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
    const protocols = Array.isArray(kit.reminderProtocols)
      ? kit.reminderProtocols
      : [];
    setIsCombo(Boolean(kit.isCombo));
    setReminderProtocols(protocols);
  }

  function save() {
    const validItems = items.filter((item) =>
      item.itemType === "service" ? !!item.serviceId : !!item.product
    );
    if (!name.trim()) {
      toast.error("Kit name is required");
      return;
    }
    if (validItems.length === 0) {
      toast.error("Add at least one product or service");
      return;
    }
    if (kind === "vaccine" && isCombo && reminderProtocols.length < 2) {
      toast.error("Combination vaccines need at least two reminder types");
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
      isCombo: kind === "vaccine" ? isCombo : false,
      reminderProtocols: kind === "vaccine" ? reminderProtocols : [],
      items: validItems.map((item, index) =>
        item.itemType === "service"
          ? {
              itemType: "service" as const,
              serviceId: item.serviceId,
              quantity: item.quantity,
              note: item.note.trim() || undefined,
              sortOrder: index,
            }
          : {
              itemType: "product" as const,
              productId: item.product!.id,
              quantity: item.quantity,
              note: item.note.trim() || undefined,
              sortOrder: index,
            }
      ),
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
            Bundles of inventory products and/or service fees (e.g. outside lab).
            Tag as Vaccine or Lab so they only appear under + Vaccine or + Lab
            test. Products deduct stock; services are for billing.
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
              onChange={(e) => {
                const next = e.target.value === "lab" ? "lab" : "vaccine";
                setKind(next);
                if (next === "lab") {
                  setIsCombo(false);
                  setReminderProtocols([]);
                  setShowProtocol(false);
                }
              }}
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
            <>
              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Reminders / alerts</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Which overdue reminder(s) this kit clears when given.
                    Optional — if blank, we infer from the vaccine name.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input"
                    checked={isCombo}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsCombo(checked);
                      if (!checked && reminderProtocols.length > 1) {
                        setReminderProtocols((prev) => prev.slice(0, 1));
                      }
                    }}
                  />
                  <span>
                    <span className="font-medium">Combination vaccine</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Needs more than one due date and reminder (e.g.
                      Lyme + Leptospirosis in one shot).
                    </span>
                  </span>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {VACCINE_PROTOCOL_OPTIONS.map((opt) => {
                    const checked = reminderProtocols.includes(opt.key);
                    return (
                      <label
                        key={opt.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type={isCombo ? "checkbox" : "radio"}
                          name={
                            isCombo
                              ? `reminder-${opt.key}`
                              : "reminder-protocol"
                          }
                          className="h-4 w-4 border-input"
                          checked={checked}
                          onChange={() => toggleReminder(opt.key)}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
                {isCombo && reminderProtocols.length < 2 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Select at least two reminder types for a combination
                    vaccine.
                  </p>
                )}
              </div>

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
                  <span>Due date interval</span>
                  {showProtocol ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {showProtocol && (
                  <div className="space-y-2 border-t border-border px-3 py-3">
                    <p className="text-xs text-muted-foreground">
                      Optional. Pre-fills next due date(s) from the date given.
                      For combination vaccines, the same interval is applied to
                      each reminder (you can edit individually when recording).
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
                            setDueIntervalUnit(
                              e.target.value as DueIntervalUnit
                            )
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
            </>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Kit items</h4>
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem_minmax(0,8rem)_auto] sm:items-start"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium">Type</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={item.itemType}
                    onChange={(e) => {
                      const nextType = e.target.value as "product" | "service";
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? {
                                ...emptyItem(nextType),
                                quantity: row.quantity,
                                note: row.note,
                              }
                            : row
                        )
                      );
                    }}
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-medium">
                    {item.itemType === "service" ? "Service / lab fee" : "Product"}
                  </label>
                  {item.itemType === "service" ? (
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={item.serviceId}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((row, i) =>
                            i === index
                              ? { ...row, serviceId: e.target.value }
                              : row
                          )
                        )
                      }
                    >
                      <option value="">
                        {(servicesList ?? []).length === 0
                          ? "No services — add under Settings → Services"
                          : "Select a service..."}
                      </option>
                      {(servicesList ?? []).map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.category
                            ? `${service.category}: ${service.name}`
                            : service.name}{" "}
                          — ${parseFloat(service.defaultPrice).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  ) : (
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
                  )}
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
                <div className="min-w-0">
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
                  className="sm:mt-5"
                  onClick={() =>
                    setItems((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem("product")])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add product
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem("service")])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add service / lab fee
              </Button>
            </div>
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
                    {kit.isCombo ? " · Combo" : ""}
                    {Array.isArray(kit.reminderProtocols) &&
                    kit.reminderProtocols.length > 0
                      ? ` · Reminders: ${kit.reminderProtocols
                          .map((key) => protocolLabel(key))
                          .join(", ")}`
                      : ""}
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
                    .map((item) => {
                      const label =
                        item.itemType === "service"
                          ? item.serviceName
                          : item.productName;
                      const kind =
                        item.itemType === "service" ? "fee" : "stock";
                      return `${item.quantity}× ${label ?? "—"} (${kind})`;
                    })
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
                  No kits yet. Add products and/or service fees (e.g. outside
                  lab) to deduct stock and bill together.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
