"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { calcTax, DEFAULT_TAX_RATE_PERCENT } from "@/lib/tax";
import {
  ProductPicker,
  type CatalogProduct,
} from "@/components/inventory/product-picker";
import { chargePriceEachWithMarkup } from "@/lib/inventory-price";
import {
  expandTemplateItems,
  applyMarkupToTemplateLines,
} from "@/lib/treatment-template";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
  usageId?: string;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export default function NewInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <NewInvoicePageContent />
    </Suspense>
  );
}

function NewInvoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const fromTemplateId = searchParams.get("fromTemplate");
  const sourceId = editId || fromTemplateId;

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Patient
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);
  const [lineKind, setLineKind] = useState<"service" | "product">("service");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogProduct | null>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState("");

  // Estimate toggle
  const [isEstimate, setIsEstimate] = useState(!!fromTemplateId);
  const [estimateName, setEstimateName] = useState("");

  // Due date
  const [dueDate, setDueDate] = useState(defaultDueDate());

  // Queries
  const clientResults = trpc.clients.search.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.length >= 1 }
  );

  const patientResults = trpc.billing.patientsByClient.useQuery(
    { clientId: selectedClient?.id ?? "" },
    { enabled: !!selectedClient }
  );

  const servicesQuery = trpc.billing.listServices.useQuery();
  const treatmentTemplatesQuery = trpc.templates.list.useQuery();
  const unbilledQuery = trpc.inventory.listUnbilledUsages.useQuery(
    { patientId: selectedPatientId },
    { enabled: !!selectedPatientId }
  );
  const billingSettings = trpc.settings.getBillingSettings.useQuery();
  const existingQuery = trpc.billing.getInvoice.useQuery(
    { id: sourceId ?? "" },
    { enabled: !!sourceId }
  );
  const [hydrated, setHydrated] = useState(!sourceId);
  const taxEnabled = billingSettings.data?.taxEnabled ?? true;
  const taxRatePercent =
    billingSettings.data?.effectiveTaxRatePercent ??
    (taxEnabled ? DEFAULT_TAX_RATE_PERCENT : 0);
  const inventoryMarkupPercent =
    billingSettings.data?.effectiveInventoryMarkupPercent ?? 0;

  // Mutation
  const utils = trpc.useUtils();
  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: (result) => {
      toast.success(
        isEstimate
          ? selectedClient
            ? "Estimate saved"
            : "Template saved"
          : "Invoice created"
      );
      if (result.stockWarned) {
        toast.warning("One or more products went below zero stock");
      }
      utils.billing.listInvoices.invalidate();
      utils.inventory.listUnbilledUsages.invalidate();
      router.push("/billing");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateInvoice = trpc.billing.updateInvoice.useMutation({
    onSuccess: () => {
      toast.success("Estimate saved");
      utils.billing.listInvoices.invalidate();
      if (editId) utils.billing.getInvoice.invalidate({ id: editId });
      router.push("/billing");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    if (!sourceId || !existingQuery.data || hydrated) return;
    const existing = existingQuery.data;
    if (editId && !existing.isEstimate) {
      toast.error("Only estimates can be edited");
      router.replace("/billing");
      return;
    }
    if (editId && existing.clientId) {
      setSelectedClient({
        id: existing.clientId,
        firstName: existing.clientFirstName ?? "",
        lastName: existing.clientLastName ?? "",
      });
      setSelectedPatientId(existing.patientId ?? "");
      setDueDate(existing.dueDate ?? defaultDueDate());
    } else {
      setSelectedClient(null);
      setSelectedPatientId("");
      if (!editId) setDueDate(defaultDueDate());
      else setDueDate(existing.dueDate ?? defaultDueDate());
    }
    setIsEstimate(true);
    setEstimateName(existing.name ?? "");
    setItems(
      existing.items.map((item) => ({
        id: fromTemplateId && !editId ? crypto.randomUUID() : item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
        itemId: item.itemId ?? undefined,
      }))
    );
    setHydrated(true);
  }, [editId, fromTemplateId, sourceId, existingQuery.data, hydrated, router]);

  // Calculations
  const { subtotal, tax, total } = useMemo(() => {
    const sub = items.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.unitPrice || "0"),
      0
    );
    const t = calcTax(sub, taxRatePercent);
    return {
      subtotal: sub,
      tax: t,
      total: Math.round((sub + t) * 100) / 100,
    };
  }, [items, taxRatePercent]);

  function handleServiceSelect(serviceId: string) {
    setSelectedServiceId(serviceId);
    const service = servicesQuery.data?.find((s) => s.id === serviceId);
    if (service) {
      setItemDescription(service.name);
      setItemUnitPrice(service.defaultPrice);
    }
  }

  function handleAddItem() {
    if (!itemDescription || !itemUnitPrice) return;
    const service = servicesQuery.data?.find(
      (s) => s.id === selectedServiceId
    );
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: itemDescription,
        quantity: itemQuantity,
        unitPrice: itemUnitPrice,
        itemType: lineKind,
        itemId:
          lineKind === "product" ? selectedProduct?.id : service?.id,
      },
    ]);
    setSelectedServiceId("");
    setSelectedProduct(null);
    setItemDescription("");
    setItemQuantity(1);
    setItemUnitPrice("");
  }

  function addUnbilledUsages() {
    const usages = unbilledQuery.data ?? [];
    if (usages.length === 0) return;
    setItems((prev) => {
      const existing = new Set(
        prev.map((item) => item.usageId).filter(Boolean)
      );
      const next = [...prev];
      for (const usage of usages) {
        if (existing.has(usage.id)) continue;
        next.push({
          id: crypto.randomUUID(),
          description: usage.productName,
          quantity: usage.quantity,
          unitPrice: chargePriceEachWithMarkup(usage, inventoryMarkupPercent),
          itemType: "product",
          itemId: usage.productId,
          usageId: usage.id,
        });
      }
      return next;
    });
  }

  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function applyTreatmentTemplate(templateId: string) {
    if (!templateId) return;
    try {
      const template = await utils.templates.getById.fetch({ id: templateId });
      if (!template.items.length) {
        toast.error("That template has no items");
        return;
      }
      const needsKits = template.items.some((item) => item.itemType === "kit");
      const kits = needsKits
        ? await utils.inventoryKits.list.fetch()
        : [];
      const lines = applyMarkupToTemplateLines(
        expandTemplateItems(template.items, kits),
        inventoryMarkupPercent
      );
      setItems((prev) => [
        ...prev,
        ...lines.map((item) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemType: item.itemType,
          itemId: item.itemId,
        })),
      ]);
      if (isEstimate && !estimateName.trim()) {
        setEstimateName(template.name);
      }
      toast.success(`Added ${template.name}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply template"
      );
    }
  }

  function handleSubmit() {
    if (items.length === 0) return;
    if (!isEstimate && !selectedClient) return;
    if (isEstimate && !selectedClient && !estimateName.trim()) {
      toast.error("Add a template name, or choose a client");
      return;
    }
    const payload = {
      clientId: selectedClient?.id,
      patientId: selectedPatientId || undefined,
      name: estimateName.trim() || null,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
        itemId: item.itemId,
        usageId: item.usageId,
      })),
      dueDate: dueDate || undefined,
    };
    if (editId) {
      updateInvoice.mutate({
        id: editId,
        clientId: selectedClient?.id ?? null,
        patientId: selectedPatientId || null,
        name: estimateName.trim() || null,
        items: payload.items,
        dueDate: dueDate || null,
      });
      return;
    }
    createInvoice.mutate({
      ...payload,
      isEstimate,
    });
  }

  const saving = createInvoice.isPending || updateInvoice.isPending;

  if (sourceId && existingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl text-sm text-muted-foreground">
        Loading estimate...
      </div>
    );
  }

  if (sourceId && existingQuery.error) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-destructive">{existingQuery.error.message}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/billing")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Billing
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/billing")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Billing
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            {editId
              ? existingQuery.data?.isTemplate
                ? "Edit Template"
                : "Edit Estimate"
              : fromTemplateId
                ? "New Estimate from Template"
                : isEstimate
                  ? "New Estimate"
                  : "New Invoice"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {editId
              ? "Update this estimate and save it to finish later."
              : fromTemplateId
                ? "Choose a client to create an estimate, or leave blank to save another template."
                : isEstimate
                  ? "Leave client blank to save a reusable template."
                  : "Create a new invoice for a client."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isEstimate}
            onChange={(e) => setIsEstimate(e.target.checked)}
            disabled={!!editId}
            className="rounded border-gray-300"
          />
          <span className="font-medium">Estimate</span>
        </label>
      </div>

      {/* Client Search */}
      <div className="mt-6 space-y-4">
        {isEstimate && (
          <div>
            <label className="block text-sm font-medium mb-1">
              {selectedClient ? "Estimate name" : "Template name"}
              {!selectedClient ? " *" : ""}
            </label>
            <Input
              value={estimateName}
              onChange={(e) => setEstimateName(e.target.value)}
              placeholder="e.g. Canine spay under 50 lbs"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Client{isEstimate ? " (optional)" : " *"}
          </label>
          {selectedClient ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedClient.firstName} {selectedClient.lastName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedClient(null);
                  setSelectedPatientId("");
                  setClientSearch("");
                  setItems((prev) => prev.filter((i) => !i.usageId));
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search clients..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              {clientSearch.length >= 1 && clientResults.data && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
                  {clientResults.data.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No clients found
                    </div>
                  ) : (
                    clientResults.data.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="w-full px-4 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          setSelectedClient({
                            id: client.id,
                            firstName: client.firstName,
                            lastName: client.lastName,
                          });
                          setClientSearch("");
                        }}
                      >
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        {client.email && (
                          <span className="ml-2 text-muted-foreground">
                            {client.email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Patient Select */}
        {selectedClient && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Patient (optional)
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                setItems((prev) => prev.filter((i) => !i.usageId));
              }}
            >
              <option value="">-- No patient --</option>
              {patientResults.data?.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({patient.species})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedPatientId && (unbilledQuery.data?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Unbilled used items</p>
                <p className="text-xs text-muted-foreground">
                  {unbilledQuery.data!.length} clinical use
                  {unbilledQuery.data!.length === 1 ? "" : "s"} not yet on an
                  invoice. Adding them will not decrement stock again.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addUnbilledUsages}
              >
                Add used items
              </Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {unbilledQuery.data!.map((usage) => (
                <li key={usage.id} className="text-muted-foreground">
                  {usage.productName} × {usage.quantity}
                  {usage.units ? ` ${usage.units}` : ""} · $
                  {chargePriceEachWithMarkup(usage, inventoryMarkupPercent)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add Line Item */}
        <div>
          <label className="block text-sm font-medium mb-1">Line Items</label>
          {(treatmentTemplatesQuery.data?.length ?? 0) > 0 && (
            <div className="mb-3">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const id = e.target.value;
                  e.target.value = "";
                  void applyTreatmentTemplate(id);
                }}
              >
                <option value="">Apply treatment template...</option>
                {treatmentTemplatesQuery.data
                  ?.filter((template) => template.isActive !== false)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.total
                        ? ` — $${Number(template.total).toFixed(2)}`
                        : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 ${
                  lineKind === "service"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                }`}
                onClick={() => {
                  setLineKind("service");
                  setSelectedProduct(null);
                  setItemDescription("");
                  setItemUnitPrice("");
                }}
              >
                Service
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 ${
                  lineKind === "product"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                }`}
                onClick={() => {
                  setLineKind("product");
                  setSelectedServiceId("");
                  setItemDescription("");
                  setItemUnitPrice("");
                }}
              >
                Product
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                {lineKind === "service" ? (
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedServiceId}
                    onChange={(e) => handleServiceSelect(e.target.value)}
                  >
                    <option value="">
                      {servicesQuery.data && servicesQuery.data.length === 0
                        ? "No services yet — add them in Settings → Services"
                        : "Select a service..."}
                    </option>
                    {servicesQuery.data?.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.category
                          ? `${service.category}: ${service.name}`
                          : service.name}{" "}
                        - ${service.defaultPrice}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ProductPicker
                    value={selectedProduct}
                    placeholder="Search products..."
                    onChange={(p) => {
                      setSelectedProduct(p);
                      if (p) {
                        setItemDescription(p.name);
                        setItemUnitPrice(
                          chargePriceEachWithMarkup(p, inventoryMarkupPercent)
                        );
                      }
                    }}
                  />
                )}
              </div>
              <div className="col-span-3">
                <Input
                  placeholder="Description"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={itemQuantity}
                  onChange={(e) =>
                    setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unit Price"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleAddItem}
                  disabled={!itemDescription || !itemUnitPrice}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {/* Item list */}
            {items.length > 0 && (
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Qty
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Price
                    </th>
                    <th className="py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2">
                        {item.description}
                        {item.usageId ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (used)
                          </span>
                        ) : item.itemType === "product" ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (product)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        $
                        {(
                          item.quantity * parseFloat(item.unitPrice)
                        ).toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {taxEnabled
                  ? `Tax (${billingSettings.data?.taxRatePercent ?? taxRatePercent}%)`
                  : "Tax (off)"}
              </span>
              <span className="tabular-nums">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1">
              <span>Total</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Due Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Due Date</label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSubmit}
            disabled={
              items.length === 0 ||
              saving ||
              (!isEstimate && !selectedClient) ||
              (isEstimate && !selectedClient && !estimateName.trim())
            }
          >
            {saving
              ? "Saving..."
              : editId
                ? selectedClient
                  ? "Save Estimate"
                  : "Save Template"
                : isEstimate
                  ? selectedClient
                    ? "Save Estimate"
                    : "Save Template"
                  : "Create Invoice"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/billing")}>
            Cancel
          </Button>
        </div>

        {(createInvoice.isError || updateInvoice.isError) && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {createInvoice.error?.message || updateInvoice.error?.message}
          </div>
        )}
      </div>
    </div>
  );
}
