"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ProductPicker,
  type CatalogProduct,
} from "@/components/inventory/product-picker";
import { chargePriceEach } from "@/lib/inventory-price";
import { kitKindLabel } from "@/lib/kit-kind";
import {
  kitChargeTotal,
  kitInventoryName,
  templateEstimateSubtotal,
  templateLineEstimateAmount,
  type TemplateItemType,
} from "@/lib/treatment-template";

// ── Templates ────────────────────────────────────────────────
const TEMPLATE_CATEGORIES = [
  "surgery",
  "wellness",
  "dental",
  "preventive",
  "emergency",
  "other",
] as const;

type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

const CATEGORY_BADGE: Record<string, string> = {
  surgery: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  wellness: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dental: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  preventive: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  emergency: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

interface TemplateItem {
  itemType: TemplateItemType;
  itemId?: string;
  product?: CatalogProduct | null;
  description: string;
  defaultQuantity: number;
  defaultUnitPrice: string;
  sortOrder: number;
}


export function VisitPlansTab() {
  const utils = trpc.useUtils();
  const { data: templateList, isLoading } = trpc.templates.list.useQuery();
  const { data: services } = trpc.billing.listServices.useQuery();
  const { data: kits } = trpc.inventoryKits.list.useQuery();
  const { data: billingSettings } = trpc.settings.getBillingSettings.useQuery();
  const inventoryMarkupPercent =
    billingSettings?.effectiveInventoryMarkupPercent ?? 0;

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    category: "other" as TemplateCategory,
  });
  const [addItems, setAddItems] = useState<TemplateItem[]>([
    {
      itemType: "product",
      description: "",
      defaultQuantity: 1,
      defaultUnitPrice: "0",
      sortOrder: 0,
    },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );

  const showForm = showAdd || !!editingId;

  const resetAddForm = () => {
    setAddForm({ name: "", description: "", category: "other" });
    setAddItems([
      {
        itemType: "product",
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: 0,
      },
    ]);
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingId(null);
    resetAddForm();
  };

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      closeForm();
      toast.success("Visit plan created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: (_data, variables) => {
      utils.templates.list.invalidate();
      utils.templates.getById.invalidate({ id: variables.id });
      if (variables.items) {
        closeForm();
      }
      toast.success("Visit plan updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      utils.templates.list.invalidate();
      setSelectedTemplateId(null);
      closeForm();
      toast.success("Visit plan deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  const addItemRow = () => {
    setAddItems([
      ...addItems,
      {
        itemType: "product",
        description: "",
        defaultQuantity: 1,
        defaultUnitPrice: "0",
        sortOrder: addItems.length,
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    setAddItems(addItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, patch: Partial<TemplateItem>) => {
    setAddItems(
      addItems.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  };

  const buildItemsPayload = () =>
    addItems
      .filter((i) => i.description.trim())
      .map((i, sortOrder) => ({
        itemType: i.itemType,
        itemId: i.itemId,
        description: i.description.trim(),
        defaultQuantity: i.defaultQuantity,
        defaultUnitPrice: i.defaultUnitPrice,
        sortOrder,
      }));

  async function startEdit(templateId: string) {
    try {
      const detail = await utils.templates.getById.fetch({ id: templateId });
      setSelectedTemplateId(null);
      setShowAdd(false);
      setEditingId(templateId);
      setAddForm({
        name: detail.name,
        description: detail.description ?? "",
        category: (TEMPLATE_CATEGORIES.includes(
          detail.category as TemplateCategory
        )
          ? detail.category
          : "other") as TemplateCategory,
      });
      setAddItems(
        detail.items.length > 0
          ? detail.items.map((item, sortOrder) => ({
              itemType:
                item.itemType === "service"
                  ? ("service" as const)
                  : item.itemType === "kit"
                    ? ("kit" as const)
                    : ("product" as const),
              itemId: item.itemId ?? undefined,
              product:
                item.itemType === "product" && item.itemId
                  ? {
                      id: item.itemId,
                      name: item.description,
                      sku: null,
                      unitPrice: item.defaultUnitPrice,
                      stockQuantity: 0,
                      units: null,
                      category: null,
                      lotNumber: null,
                    }
                  : null,
              description: item.description,
              defaultQuantity: item.defaultQuantity,
              defaultUnitPrice: item.defaultUnitPrice,
              sortOrder,
            }))
          : [
              {
                itemType: "product" as const,
                description: "",
                defaultQuantity: 1,
                defaultUnitPrice: "0",
                sortOrder: 0,
              },
            ]
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load template"
      );
    }
  }

  function handleDelete(templateId: string, name: string) {
    if (!confirm(`Delete template “${name}”? This cannot be undone.`)) return;
    deleteMutation.mutate({ id: templateId });
  }

  function handleSave() {
    const items = buildItemsPayload();
    if (!addForm.name.trim() || items.length === 0) return;
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        category: addForm.category,
        items,
      });
      return;
    }
    createMutation.mutate({
      name: addForm.name.trim(),
      description: addForm.description.trim() || undefined,
      category: addForm.category,
      items,
    });
  }

  const selectedTemplate = templateList?.find(
    (t) => t.id === selectedTemplateId
  );
  const { data: selectedTemplateDetail } = trpc.templates.getById.useQuery(
    { id: selectedTemplateId! },
    { enabled: !!selectedTemplateId }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Detail view for a selected template
  if (selectedTemplate && !showForm) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedTemplateId(null)}
          >
            <X className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h3 className="text-sm font-semibold">{selectedTemplate.name}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              selectedTemplate.isActive !== false
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
            )}
          >
            {selectedTemplate.isActive !== false ? "Active" : "Inactive"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => startEdit(selectedTemplate.id)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: selectedTemplate.id,
                isActive: !selectedTemplate.isActive,
              })
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {selectedTemplate.isActive !== false ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() =>
              handleDelete(selectedTemplate.id, selectedTemplate.name)
            }
          >
            <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" />
            Delete
          </Button>
        </div>

        {selectedTemplate.description && (
          <p className="text-sm text-muted-foreground">
            {selectedTemplate.description}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Quantity</th>
                <th className="px-4 py-3 text-right font-medium">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium">
                  Line total
                  {inventoryMarkupPercent > 0 ? " (w/ markup)" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedTemplateDetail?.items?.map((item, i) => (
                <tr
                  key={item.id ?? i}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{item.description}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {item.itemType}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.defaultQuantity}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    ${Number(item.defaultUnitPrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    $
                    {templateLineEstimateAmount(
                      item,
                      inventoryMarkupPercent
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
              {(!selectedTemplateDetail?.items ||
                selectedTemplateDetail.items.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No items in this template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(selectedTemplateDetail?.items?.length ?? 0) > 0 && (
          <div className="flex justify-end text-sm">
            <div className="rounded-lg border border-border px-4 py-2">
              <span className="text-muted-foreground">
                Estimate total
                {inventoryMarkupPercent > 0
                  ? ` (incl. ${inventoryMarkupPercent}% product markup)`
                  : ""}
                :{" "}
              </span>
              <span className="font-semibold tabular-nums">
                $
                {templateEstimateSubtotal(
                  selectedTemplateDetail!.items,
                  inventoryMarkupPercent
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Visit plans</h3>
          <p className="text-xs text-muted-foreground">
            Reusable line-item plans to apply when creating estimates and invoices.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add visit plan
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">
            {editingId ? "Edit visit plan" : "New visit plan"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Plan name"
              value={addForm.name}
              onChange={(e) =>
                setAddForm({ ...addForm, name: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.category}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  category: e.target.value as TemplateCategory,
                })
              }
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Description (optional)"
            value={addForm.description}
            onChange={(e) =>
              setAddForm({ ...addForm, description: e.target.value })
            }
          />

          {/* Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Items</h4>
            {addItems.map((item, index) => {
              return (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_5rem_6.5rem_auto] sm:items-start"
              >
                <select
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={item.itemType}
                  onChange={(e) =>
                    updateItem(index, {
                      itemType: e.target.value as TemplateItemType,
                      itemId: undefined,
                      product: null,
                      description: "",
                      defaultUnitPrice: "0",
                    })
                  }
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                  <option value="kit">Kit</option>
                </select>
                {item.itemType === "product" ? (
                  <ProductPicker
                    value={item.product ?? null}
                    placeholder="Search inventory..."
                    onChange={(product) => {
                      if (!product) {
                        updateItem(index, {
                          itemId: undefined,
                          product: null,
                          description: "",
                          defaultUnitPrice: "0",
                        });
                        return;
                      }
                      updateItem(index, {
                        itemId: product.id,
                        product,
                        description: product.name,
                        defaultUnitPrice: chargePriceEach(product),
                      });
                    }}
                  />
                ) : item.itemType === "kit" ? (
                  <div className="min-w-0">
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={item.itemId ?? ""}
                      onChange={(e) => {
                        const kit = kits?.find(
                          (row) => row.id === e.target.value
                        );
                        updateItem(index, {
                          itemId: kit?.id,
                          description: kit ? kitInventoryName(kit) : "",
                          defaultUnitPrice: kit ? kitChargeTotal(kit) : "0",
                        });
                      }}
                    >
                      <option value="">
                        {kits && kits.filter((k) => k.isActive !== false).length === 0
                          ? "No kits — add them under Catalog → Kits"
                          : "Select a kit..."}
                      </option>
                      {(kits ?? [])
                        .filter(
                          (kit) =>
                            kit.isActive !== false || kit.id === item.itemId
                        )
                        .map((kit) => (
                          <option key={kit.id} value={kit.id}>
                            {kitKindLabel(kit.kind)}: {kitInventoryName(kit)} — $
                            {kitChargeTotal(kit)}
                          </option>
                        ))}
                    </select>
                    {(() => {
                      const selectedKit = kits?.find(
                        (row) => row.id === item.itemId
                      );
                      if (!selectedKit?.items.length) return null;
                      return (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {selectedKit.items
                            .map(
                              (kitItem) =>
                                `${kitItem.quantity}× ${
                                  kitItem.productName || "Item"
                                }`
                            )
                            .join(", ")}
                        </p>
                      );
                    })()}
                  </div>
                ) : (
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={item.itemId ?? ""}
                    onChange={(e) => {
                      const service = services?.find(
                        (row) => row.id === e.target.value
                      );
                      updateItem(index, {
                        itemId: service?.id,
                        description: service?.name ?? "",
                        defaultUnitPrice: service?.defaultPrice ?? "0",
                      });
                    }}
                  >
                    <option value="">
                      {services && services.length === 0
                        ? "No services — add them under Catalog → Services"
                        : "Select a service..."}
                    </option>
                    {services?.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.category
                          ? `${service.category}: ${service.name}`
                          : service.name}{" "}
                        — ${service.defaultPrice}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  type="number"
                  placeholder="Qty"
                  min={1}
                  value={item.defaultQuantity}
                  onChange={(e) =>
                    updateItem(index, {
                      defaultQuantity: Math.max(
                        1,
                        parseInt(e.target.value, 10) || 1
                      ),
                    })
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={item.defaultUnitPrice}
                  onChange={(e) =>
                    updateItem(index, {
                      defaultUnitPrice: e.target.value,
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={addItems.length <= 1}
                  onClick={() => removeItemRow(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={addItemRow}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
            {addItems.some((i) => i.description.trim()) && (
              <p className="text-sm text-muted-foreground">
                Estimate total
                {inventoryMarkupPercent > 0
                  ? ` (incl. ${inventoryMarkupPercent}% product markup)`
                  : ""}
                :{" "}
                <span className="font-medium text-foreground tabular-nums">
                  $
                  {templateEstimateSubtotal(
                    addItems.filter((i) => i.description.trim()),
                    inventoryMarkupPercent
                  )}
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !addForm.name.trim() ||
                addItems.every((i) => !i.description.trim()) ||
                saving
              }
              onClick={handleSave}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
          {(createMutation.error || updateMutation.error) && (
            <p className="text-sm text-destructive">
              {createMutation.error?.message || updateMutation.error?.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-right font-medium">
                Estimate total
              </th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templateList?.map((template) => (
              <tr
                key={template.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <td className="px-4 py-3 font-medium">{template.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      CATEGORY_BADGE[template.category ?? "other"] ?? CATEGORY_BADGE.other
                    )}
                  >
                    {template.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  ${Number(template.total ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      template.isActive !== false
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                    )}
                  >
                    {template.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Use on estimate"
                      asChild
                    >
                      <Link
                        href={`/billing/new?estimate=1&fromVisitPlan=${template.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileText className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        void startEdit(template.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={
                        template.isActive !== false ? "Deactivate" : "Activate"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        updateMutation.mutate({
                          id: template.id,
                          isActive: !template.isActive,
                        });
                      }}
                    >
                      {template.isActive !== false ? (
                        <X className="h-4 w-4 text-destructive" />
                      ) : (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      disabled={deleteMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template.id, template.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {templateList?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No visit plans yet. Create one to apply on estimates and invoices.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

