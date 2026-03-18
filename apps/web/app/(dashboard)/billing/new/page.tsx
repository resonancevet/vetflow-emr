"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export default function NewInvoicePage() {
  const router = useRouter();

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
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState("");

  // Estimate toggle
  const [isEstimate, setIsEstimate] = useState(false);

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

  // Mutation
  const utils = trpc.useUtils();
  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      utils.billing.listInvoices.invalidate();
      router.push("/billing");
    },
  });

  // Calculations
  const { subtotal, tax, total } = useMemo(() => {
    const sub = items.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.unitPrice || "0"),
      0
    );
    const t = Math.round(sub * 0.08 * 100) / 100;
    return {
      subtotal: sub,
      tax: t,
      total: Math.round((sub + t) * 100) / 100,
    };
  }, [items]);

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
        itemType: "service",
        itemId: service?.id,
      },
    ]);
    setSelectedServiceId("");
    setItemDescription("");
    setItemQuantity(1);
    setItemUnitPrice("");
  }

  function handleRemoveItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit() {
    if (!selectedClient || items.length === 0) return;
    createInvoice.mutate({
      clientId: selectedClient.id,
      patientId: selectedPatientId || undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemType: item.itemType,
        itemId: item.itemId,
      })),
      dueDate: dueDate || undefined,
      isEstimate,
    });
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
            {isEstimate ? "New Estimate" : "New Invoice"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEstimate
              ? "Create an estimate that can be converted to an invoice later."
              : "Create a new invoice for a client."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isEstimate}
            onChange={(e) => setIsEstimate(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="font-medium">Estimate</span>
        </label>
      </div>

      {/* Client Search */}
      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
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
              onChange={(e) => setSelectedPatientId(e.target.value)}
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

        {/* Add Line Item */}
        <div>
          <label className="block text-sm font-medium mb-1">Line Items</label>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedServiceId}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                >
                  <option value="">Select a service...</option>
                  {servicesQuery.data?.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - ${service.defaultPrice}
                    </option>
                  ))}
                </select>
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
                      Unit Price
                    </th>
                    <th className="py-2 text-right font-medium text-muted-foreground">
                      Total
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
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-right tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        ${parseFloat(item.unitPrice).toFixed(2)}
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
              <span className="text-muted-foreground">Tax (8%)</span>
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
              !selectedClient ||
              items.length === 0 ||
              createInvoice.isPending
            }
          >
            {createInvoice.isPending
              ? "Creating..."
              : isEstimate
              ? "Create Estimate"
              : "Create Invoice"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/billing")}>
            Cancel
          </Button>
        </div>

        {createInvoice.isError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            {createInvoice.error.message}
          </div>
        )}
      </div>
    </div>
  );
}
