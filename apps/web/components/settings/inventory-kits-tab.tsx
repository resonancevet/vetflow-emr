"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
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

type ComboSlot = {
  protocol: string;
  value: string;
  unit: DueIntervalUnit;
};

const emptyItem = (itemType: "product" | "service" = "product"): KitItemDraft => ({
  itemType,
  product: null,
  serviceId: "",
  quantity: 1,
  note: "",
});

const emptySlot = (): ComboSlot => ({
  protocol: "",
  value: "1",
  unit: "years",
});

function unitFrom(value: string | null | undefined): DueIntervalUnit {
  return value === "days" ||
    value === "weeks" ||
    value === "months" ||
    value === "years"
    ? value
    : "years";
}

function ProtocolDueRow({
  label,
  slot,
  excludeProtocol,
  onChange,
}: {
  label: string;
  slot: ComboSlot;
  excludeProtocol?: string;
  onChange: (next: ComboSlot) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem] sm:items-end">
      <div className="min-w-0">
        <label className="mb-1 block text-xs font-medium">{label}</label>
        <select
          value={slot.protocol}
          onChange={(e) => onChange({ ...slot, protocol: e.target.value })}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select vaccine…</option>
          {VACCINE_PROTOCOL_OPTIONS.map((opt) => (
            <option
              key={opt.key}
              value={opt.key}
              disabled={
                Boolean(excludeProtocol) &&
                excludeProtocol === opt.key &&
                slot.protocol !== opt.key
              }
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Interval</label>
        <Input
          type="number"
          min={1}
          value={slot.value}
          onChange={(e) => onChange({ ...slot, value: e.target.value })}
          placeholder="1"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Unit</label>
        <select
          value={slot.unit}
          onChange={(e) =>
            onChange({ ...slot, unit: e.target.value as DueIntervalUnit })
          }
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {DUE_INTERVAL_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit.charAt(0).toUpperCase() + unit.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

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
  const [isCombo, setIsCombo] = useState(false);
  const [singleSlot, setSingleSlot] = useState<ComboSlot>(emptySlot());
  const [comboSlot1, setComboSlot1] = useState<ComboSlot>(emptySlot());
  const [comboSlot2, setComboSlot2] = useState<ComboSlot>(emptySlot());

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
    setIsCombo(false);
    setSingleSlot(emptySlot());
    setComboSlot1(emptySlot());
    setComboSlot2(emptySlot());
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function slotFromStored(
    key: string | undefined,
    stored: Record<string, { value?: number; unit?: string }>,
    fallbackValue?: number | null,
    fallbackUnit?: string | null,
  ): ComboSlot {
    if (!key) return emptySlot();
    const row = stored[key];
    return {
      protocol: key,
      value: row?.value
        ? String(row.value)
        : fallbackValue
          ? String(fallbackValue)
          : "1",
      unit: unitFrom(row?.unit ?? fallbackUnit),
    };
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

    const protocols = Array.isArray(kit.reminderProtocols)
      ? kit.reminderProtocols
      : [];
    const stored =
      kit.reminderDueIntervals &&
      typeof kit.reminderDueIntervals === "object" &&
      !Array.isArray(kit.reminderDueIntervals)
        ? (kit.reminderDueIntervals as Record<
            string,
            { value?: number; unit?: string }
          >)
        : {};
    const combo = Boolean(kit.isCombo) && protocols.length >= 2;
    setIsCombo(combo);

    if (combo) {
      setComboSlot1(
        slotFromStored(
          protocols[0],
          stored,
          kit.dueIntervalValue,
          kit.dueIntervalUnit,
        ),
      );
      setComboSlot2(
        slotFromStored(
          protocols[1],
          stored,
          kit.dueIntervalValue,
          kit.dueIntervalUnit,
        ),
      );
      setSingleSlot(emptySlot());
    } else {
      const key = protocols[0];
      if (key) {
        setSingleSlot(
          slotFromStored(
            key,
            stored,
            kit.dueIntervalValue,
            kit.dueIntervalUnit,
          ),
        );
      } else if (kit.dueIntervalValue) {
        setSingleSlot({
          protocol: "",
          value: String(kit.dueIntervalValue),
          unit: unitFrom(kit.dueIntervalUnit),
        });
      } else {
        setSingleSlot(emptySlot());
      }
      setComboSlot1(emptySlot());
      setComboSlot2(emptySlot());
    }
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

    let reminderProtocols: string[] = [];
    let reminderDueIntervals: Record<
      string,
      { value: number; unit: DueIntervalUnit }
    > = {};
    let dueIntervalValue: number | null = null;
    let dueIntervalUnit: DueIntervalUnit | null = null;
    let combo = false;

    if (kind === "vaccine" && isCombo) {
      if (!comboSlot1.protocol || !comboSlot2.protocol) {
        toast.error("Select both vaccines for the combination");
        return;
      }
      if (comboSlot1.protocol === comboSlot2.protocol) {
        toast.error("Choose two different vaccines for the combination");
        return;
      }
      const v1 = Number(comboSlot1.value);
      const v2 = Number(comboSlot2.value);
      if (!Number.isFinite(v1) || v1 < 1 || !Number.isFinite(v2) || v2 < 1) {
        toast.error("Enter a due interval for each vaccine");
        return;
      }
      combo = true;
      reminderProtocols = [comboSlot1.protocol, comboSlot2.protocol];
      reminderDueIntervals = {
        [comboSlot1.protocol]: { value: v1, unit: comboSlot1.unit },
        [comboSlot2.protocol]: { value: v2, unit: comboSlot2.unit },
      };
    } else if (kind === "vaccine") {
      if (singleSlot.protocol) {
        reminderProtocols = [singleSlot.protocol];
      }
      const interval = Number(singleSlot.value);
      if (Number.isFinite(interval) && interval >= 1) {
        dueIntervalValue = interval;
        dueIntervalUnit = singleSlot.unit;
        if (singleSlot.protocol) {
          reminderDueIntervals = {
            [singleSlot.protocol]: {
              value: interval,
              unit: singleSlot.unit,
            },
          };
        }
      }
    }

    const payload = {
      name: name.trim(),
      kind,
      planName: planName.trim() || null,
      dueIntervalValue,
      dueIntervalUnit,
      isCombo: combo,
      reminderProtocols,
      reminderDueIntervals,
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
              placeholder="e.g. DA2PPL canine"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium">Type</label>
              <select
                value={kind}
                onChange={(e) => {
                  const next = e.target.value === "lab" ? "lab" : "vaccine";
                  setKind(next);
                  if (next === "lab") {
                    setIsCombo(false);
                    setSingleSlot(emptySlot());
                    setComboSlot1(emptySlot());
                    setComboSlot2(emptySlot());
                  }
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="vaccine">Vaccine</option>
                <option value="lab">Lab</option>
              </select>
            </div>
            {kind === "vaccine" && (
              <label className="flex h-10 items-center gap-2 whitespace-nowrap text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={isCombo}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsCombo(checked);
                    if (checked) {
                      setComboSlot1(
                        singleSlot.protocol
                          ? { ...singleSlot }
                          : emptySlot(),
                      );
                      setComboSlot2(emptySlot());
                    } else {
                      setSingleSlot(
                        comboSlot1.protocol
                          ? { ...comboSlot1 }
                          : emptySlot(),
                      );
                      setComboSlot1(emptySlot());
                      setComboSlot2(emptySlot());
                    }
                  }}
                />
                Combination vaccine
              </label>
            )}
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            Vaccine kits show on + Vaccine. Lab kits show on + Lab test.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium">Plan name</label>
            <Input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. DA2PPL"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              How this appears in the SOAP plan. Leave blank to use the
              inventory name.
            </p>
          </div>

          {kind === "vaccine" &&
            (isCombo ? (
              <div className="space-y-3">
                <ProtocolDueRow
                  label="First vaccine"
                  slot={comboSlot1}
                  excludeProtocol={comboSlot2.protocol}
                  onChange={setComboSlot1}
                />
                <ProtocolDueRow
                  label="Second vaccine"
                  slot={comboSlot2}
                  excludeProtocol={comboSlot1.protocol}
                  onChange={setComboSlot2}
                />
              </div>
            ) : (
              <ProtocolDueRow
                label="Vaccine reminder"
                slot={singleSlot}
                onChange={setSingleSlot}
              />
            ))}

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
                    {item.itemType === "service"
                      ? "Service / lab fee"
                      : "Product"}
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
                                quantity: Math.max(
                                  1,
                                  parseInt(e.target.value, 10) || 1
                                ),
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
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={items.length <= 1}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add product
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [...prev, emptyItem("service")])
                }
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
                          .map((key) => {
                            const intervals =
                              kit.reminderDueIntervals &&
                              typeof kit.reminderDueIntervals === "object" &&
                              !Array.isArray(kit.reminderDueIntervals)
                                ? (kit.reminderDueIntervals as Record<
                                    string,
                                    { value?: number; unit?: string }
                                  >)
                                : {};
                            const row = intervals[key];
                            const due = formatDueInterval(
                              row?.value ??
                                (!kit.isCombo ? kit.dueIntervalValue : null),
                              row?.unit ??
                                (!kit.isCombo ? kit.dueIntervalUnit : null),
                            );
                            return due
                              ? `${protocolLabel(key)} (${due})`
                              : protocolLabel(key);
                          })
                          .join(", ")}`
                      : !kit.isCombo &&
                          formatDueInterval(
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
                  No inventory kits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
