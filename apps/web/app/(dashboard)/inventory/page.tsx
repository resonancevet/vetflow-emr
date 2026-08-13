"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search,
  Package,
  Plus,
  Pencil,
  Truck,
  X,
  Check,
  Trash2,
  Upload,
  Download,
  Loader2,
  Archive,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  normalizePrice,
  calcCostPerCount,
  todayDateString,
} from "@/lib/inventory-price";

const CATEGORIES = [
  { label: "All Categories", value: "" },
  { label: "Medication", value: "medication" },
  { label: "Vaccine", value: "vaccine" },
  { label: "Preventive", value: "preventive" },
  { label: "Supplement", value: "supplement" },
  { label: "Food", value: "food" },
  { label: "Supply", value: "supply" },
] as const;

const UNIT_OPTIONS = [
  "doses",
  "tablets",
  "capsules",
  "L",
  "mL",
  "oz",
  "gal",
  "pieces",
  "g",
  "mg",
  "IU",
] as const;

type MainTab = "products" | "orders" | "suppliers";

function formatCurrency(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  if (isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

const dateSelectClass =
  "h-8 rounded-md border border-input bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Uncontrolled digits input — commits on blur so typing isn't raced by refetches. */
function DigitsField({
  value,
  onCommit,
  className,
  allowEmpty = false,
  emptyAs,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  className?: string;
  allowEmpty?: boolean;
  /** Used when the field is cleared and allowEmpty is false. */
  emptyAs?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.value = value != null ? String(value) : "";
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      defaultValue={value != null ? String(value) : ""}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onBlur={() => {
        const el = inputRef.current;
        if (!el) return;
        const raw = el.value.replace(/[^\d]/g, "").trim();
        if (raw === "") {
          if (allowEmpty) {
            el.value = "";
            if (valueRef.current != null) onCommit(null);
            return;
          }
          const fallback = emptyAs ?? valueRef.current ?? 0;
          el.value = String(fallback);
          if (fallback !== valueRef.current) onCommit(fallback);
          return;
        }
        const next = parseInt(raw, 10);
        if (isNaN(next)) {
          el.value = valueRef.current != null ? String(valueRef.current) : "";
          return;
        }
        el.value = String(next);
        if (next !== valueRef.current) onCommit(next);
      }}
    />
  );
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function getRowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const match = Object.entries(row).find(
      ([k]) =>
        k.toLowerCase().replace(/[_\s]/g, "") ===
        key.toLowerCase().replace(/[_\s]/g, "")
    );
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function downloadOrderTemplateCSV() {
  const sample = [
    "Item,SKU,Manufacturer,Unit Price,Quantity,Total Price",
    "Rimadyl 100mg,RIM-100,MWI,4500,1,4500",
    "Heartgard Plus,HG-PLUS,MWI,3200,2,6400",
  ].join("\n");
  const blob = new Blob([sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "order-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({
  status,
}: {
  status: "complete" | "incomplete" | "not_received" | "low" | "ok" | "review";
}) {
  const styles: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    ok: "bg-green-100 text-green-700",
    incomplete: "bg-amber-100 text-amber-700",
    low: "bg-amber-100 text-amber-700",
    not_received: "bg-red-100 text-red-700",
    review: "bg-orange-100 text-orange-800",
  };
  const labels: Record<string, string> = {
    complete: "Complete",
    incomplete: "Incomplete",
    not_received: "Not received",
    low: "Low Stock",
    ok: "In Stock",
    review: "Needs review",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

function SupplierAutocomplete({
  value,
  onChange,
  suppliers,
}: {
  value: string;
  onChange: (v: string) => void;
  suppliers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Supplier"
        className="h-8 text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
          {filtered.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s.name);
                setOpen(false);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Products tab ---

function suggestedReorderQty(stockQuantity: number, reorderPoint: number | null) {
  return Math.max(1, (reorderPoint ?? 10) - stockQuantity);
}

function ProductsTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState<Record<string, number>>({});
  const [countNote, setCountNote] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [orderQtys, setOrderQtys] = useState<Record<string, number>>({});

  const productsQuery = trpc.inventory.list.useQuery({
    search: search || undefined,
    category: category || undefined,
    limit: counting || lowStockOnly ? 500 : 100,
    offset: 0,
  });

  const deleteMutation = trpc.inventory.delete.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      toast.success("Product deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const cycleCount = trpc.inventory.cycleCount.useMutation({
    onSuccess: (result) => {
      const warned = result.results.some((r) => r.warned);
      toast.success("Cycle count saved");
      if (warned) toast.warning("One or more counts left stock negative");
      utils.inventory.list.invalidate();
      setCounting(false);
      setCounted({});
      setCountNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const createOrderFromProducts =
    trpc.inventory.createOrderFromProducts.useMutation({
      onSuccess: () => {
        toast.success("Order created — open the Orders tab to receive it");
        utils.inventory.listOrders.invalidate();
        setSelectedIds({});
        setOrderQtys({});
      },
      onError: (err) => toast.error(err.message),
    });

  const visibleItems = (productsQuery.data?.items ?? []).filter((p) =>
    lowStockOnly ? p.stockStatus === "low" : true
  );

  function startCount() {
    const init: Record<string, number> = {};
    for (const p of visibleItems) init[p.id] = p.stockQuantity;
    setCounted(init);
    setCountNote("");
    setCounting(true);
    setEditingId(null);
  }

  function saveCount() {
    const items = visibleItems
      .map((p) => ({
        productId: p.id,
        countedQuantity: counted[p.id] ?? p.stockQuantity,
        note: countNote.trim() || undefined,
      }))
      .filter((row) => {
        const product = visibleItems.find((p) => p.id === row.productId);
        return product && row.countedQuantity !== product.stockQuantity;
      });
    if (items.length === 0) {
      toast.success("No variances to save");
      setCounting(false);
      return;
    }
    cycleCount.mutate({ items });
  }

  function createSelectedOrder() {
    const items = visibleItems
      .filter((p) => selectedIds[p.id])
      .map((p) => ({
        productId: p.id,
        quantity:
          orderQtys[p.id] ??
          suggestedReorderQty(p.stockQuantity, p.reorderPoint),
      }));
    if (items.length === 0) {
      toast.error("Select at least one product");
      return;
    }
    createOrderFromProducts.mutate({ items });
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              if (!e.target.checked) {
                setSelectedIds({});
                setOrderQtys({});
              }
            }}
          />
          Low stock
        </label>
        {counting ? (
          <>
            <Input
              className="max-w-xs"
              placeholder="Count note (optional)"
              value={countNote}
              onChange={(e) => setCountNote(e.target.value)}
            />
            <Button
              size="sm"
              onClick={saveCount}
              disabled={cycleCount.isPending}
            >
              {cycleCount.isPending ? "Saving..." : "Save count"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCounting(false);
                setCounted({});
                setCountNote("");
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={startCount}>
            <ClipboardCheck className="mr-1 h-4 w-4" />
            Count
          </Button>
        )}
        {lowStockOnly && (
          <Button
            size="sm"
            onClick={createSelectedOrder}
            disabled={createOrderFromProducts.isPending}
          >
            {createOrderFromProducts.isPending
              ? "Creating..."
              : "Create order"}
          </Button>
        )}
        {productsQuery.data && (
          <p className="text-sm text-muted-foreground">
            {lowStockOnly ? visibleItems.length : productsQuery.data.total}{" "}
            product
            {(lowStockOnly ? visibleItems.length : productsQuery.data.total) !==
            1
              ? "s"
              : ""}
          </p>
        )}
      </div>

      {productsQuery.isLoading ? (
        <div className="mt-6 text-center text-muted-foreground">Loading...</div>
      ) : productsQuery.data && visibleItems.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  ...(lowStockOnly ? ["Order"] : []),
                  "Name",
                  "SKU",
                  "Category",
                  "Supplier",
                  "Unit Price",
                  "Stock",
                  ...(counting ? ["Counted", "Variance"] : []),
                  "Cost",
                  "Reorder Pt",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((product) =>
                editingId === product.id ? (
                  <EditProductRow
                    key={product.id}
                    product={product}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    {lowStockOnly && (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!selectedIds[product.id]}
                            onChange={(e) =>
                              setSelectedIds((prev) => ({
                                ...prev,
                                [product.id]: e.target.checked,
                              }))
                            }
                          />
                          <input
                            type="number"
                            min={1}
                            className="h-8 w-16 rounded-md border border-input bg-background px-1.5 text-xs"
                            value={
                              orderQtys[product.id] ??
                              suggestedReorderQty(
                                product.stockQuantity,
                                product.reorderPoint
                              )
                            }
                            onChange={(e) =>
                              setOrderQtys((prev) => ({
                                ...prev,
                                [product.id]: Math.max(
                                  1,
                                  parseInt(e.target.value, 10) || 1
                                ),
                              }))
                            }
                          />
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-3 font-medium">{product.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {product.sku || "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground capitalize">
                      {product.category || "—"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {product.supplierName || "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {formatCurrency(product.unitPrice)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {product.stockQuantity}
                      {product.units ? (
                        <span className="ml-1 text-muted-foreground">
                          {product.units}
                        </span>
                      ) : null}
                    </td>
                    {counting && (
                      <>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            className="h-8 w-20"
                            value={counted[product.id] ?? product.stockQuantity}
                            onChange={(e) =>
                              setCounted((prev) => ({
                                ...prev,
                                [product.id]: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {(counted[product.id] ?? product.stockQuantity) -
                            product.stockQuantity}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {product.costPrice
                        ? formatCurrency(product.costPrice)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">
                      {product.reorderPoint ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {product.needsReview && <StatusBadge status="review" />}
                        <StatusBadge
                          status={product.stockStatus === "low" ? "low" : "ok"}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingId(product.id)}
                          title="Edit"
                          disabled={counting}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive"
                          disabled={counting}
                          onClick={() => {
                            if (confirm(`Delete "${product.name}"?`)) {
                              deleteMutation.mutate({ id: product.id });
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            {lowStockOnly
              ? "No low-stock products."
              : "No products yet. Receive stock from the Orders tab."}
          </p>
        </div>
      )}
    </>
  );
}

function EditProductRow({
  product,
  onClose,
}: {
  product: {
    id: string;
    name: string;
    planName?: string | null;
    sku: string | null;
    category: string | null;
    supplierName: string | null;
    unitPrice: string;
    costPrice: string | null;
    stockQuantity: number;
    reorderPoint: number | null;
    units: string | null;
    needsReview: boolean;
  };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const suppliersQuery = trpc.inventory.listSuppliers.useQuery();
  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success("Product updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    name: product.name,
    planName: product.planName ?? "",
    sku: product.sku ?? "",
    category: product.category ?? "",
    supplierName: product.supplierName ?? "",
    unitPrice: product.unitPrice,
    costPrice: product.costPrice ?? "",
    stockQuantity: product.stockQuantity,
    reorderPoint: product.reorderPoint ?? 10,
    units: product.units ?? "",
    needsReview: product.needsReview,
  });

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-3 py-2">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-sm"
        />
        <Input
          value={form.planName}
          onChange={(e) => setForm({ ...form, planName: e.target.value })}
          className="mt-1 h-8 text-sm"
          placeholder="Plan name (optional)"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">—</option>
          {CATEGORIES.slice(1).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <SupplierAutocomplete
          value={form.supplierName}
          onChange={(supplierName) => setForm({ ...form, supplierName })}
          suppliers={suppliersQuery.data ?? []}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          value={form.stockQuantity}
          onChange={(e) =>
            setForm({
              ...form,
              stockQuantity: parseInt(e.target.value, 10) || 0,
            })
          }
          className="h-8 text-sm w-20"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          value={form.reorderPoint}
          onChange={(e) =>
            setForm({
              ...form,
              reorderPoint: parseInt(e.target.value, 10) || 0,
            })
          }
          className="h-8 text-sm w-20"
        />
      </td>
      <td className="px-3 py-2">
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={form.needsReview}
            onChange={(e) =>
              setForm({ ...form, needsReview: e.target.checked })
            }
          />
          Review
        </label>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() =>
              updateMutation.mutate({
                id: product.id,
                name: form.name,
                planName: form.planName.trim() || null,
                sku: form.sku || null,
                category: form.category || null,
                supplierName: form.supplierName || null,
                unitPrice: form.unitPrice,
                costPrice: form.costPrice || null,
                stockQuantity: form.stockQuantity,
                reorderPoint: form.reorderPoint,
                units: form.units || null,
                needsReview: form.needsReview,
              })
            }
            disabled={updateMutation.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// --- Orders tab ---

function OrdersTab() {
  const utils = trpc.useUtils();
  const [showArchive, setShowArchive] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddLine, setShowAddLine] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);

  const ordersQuery = trpc.inventory.listOrders.useQuery({
    status: showArchive ? "archived" : "active",
  });
  const suppliersQuery = trpc.inventory.listSuppliers.useQuery();

  if (showArchive) {
    return (
      <ArchivedOrdersView
        orders={ordersQuery.data ?? []}
        isLoading={ordersQuery.isLoading}
        onBack={() => setShowArchive(false)}
        onReopened={() => setShowArchive(false)}
      />
    );
  }

  return (
    <div className="pb-[50vh]">
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowArchive(true)}
        >
          <Archive className="h-4 w-4 mr-1" /> Archived / Past orders
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowImport(true);
              setShowNewOrder(false);
            }}
          >
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowNewOrder(true);
              setShowImport(false);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> New Order
          </Button>
        </div>
      </div>

      {showImport && (
        <ImportOrderPanel
          onClose={() => setShowImport(false)}
          suppliers={suppliersQuery.data ?? []}
        />
      )}

      {showNewOrder && (
        <NewOrderForm
          onClose={() => setShowNewOrder(false)}
          suppliers={suppliersQuery.data ?? []}
        />
      )}

      {ordersQuery.isLoading ? (
        <div className="mt-6 text-center text-muted-foreground">Loading...</div>
      ) : ordersQuery.data && ordersQuery.data.length > 0 ? (
        <div className="mt-4 space-y-4">
          {ordersQuery.data.map((order) => (
            <ActiveOrderCard
              key={order.id}
              order={order}
              suppliers={suppliersQuery.data ?? []}
              showAddLine={showAddLine === order.id}
              onToggleAddLine={() =>
                setShowAddLine(showAddLine === order.id ? null : order.id)
              }
              onChanged={() => utils.inventory.listOrders.invalidate()}
              csvLocked={order.importedFromCsv}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            No active orders. Import a CSV or create a new order.
          </p>
        </div>
      )}
    </div>
  );
}

function ArchivedOrdersView({
  orders,
  isLoading,
  onBack,
  onReopened,
}: {
  orders: {
    id: string;
    dateOrdered: string;
    dateReceived: string | null;
    supplierName: string | null;
    completionStatus: "complete" | "incomplete" | "not_received";
    items: {
      id: string;
      name: string;
      sku: string | null;
      unitPrice: string;
      quantity: number;
      calculatedTotal: string;
      isReceived: boolean;
      qtyReceived: number | null;
      count: number | null;
      units: string | null;
      category: string | null;
    }[];
  }[];
  isLoading: boolean;
  onBack: () => void;
  onReopened: () => void;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const reopenMutation = trpc.inventory.reopenOrder.useMutation({
    onSuccess: () => {
      utils.inventory.listOrders.invalidate();
      toast.success("Order moved back to active");
      setReopeningId(null);
      onReopened();
    },
    onError: (err) => {
      setReopeningId(null);
      toast.error(err.message);
    },
  });

  return (
    <div className="mt-4 pb-[50vh]">
      <Button size="sm" variant="ghost" onClick={onBack} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to active orders
      </Button>
      <h3 className="font-medium text-sm mb-3">Archived / Past orders</h3>
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No archived orders yet.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            return (
              <div
                key={order.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left text-sm hover:opacity-80"
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-medium">
                      Ordered {order.dateOrdered}
                    </span>
                    <span className="text-muted-foreground">
                      Received {order.dateReceived || "—"}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {order.supplierName || "No supplier"}
                    </span>
                    <span className="ml-auto shrink-0">
                      <StatusBadge status={order.completionStatus} />
                    </span>
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={reopenMutation.isPending && reopeningId === order.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReopeningId(order.id);
                      reopenMutation.mutate({ id: order.id });
                    }}
                  >
                    {reopenMutation.isPending && reopeningId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Reopen"
                    )}
                  </Button>
                </div>
                {isOpen && (
                  <div className="border-t border-border px-4 py-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1 text-left font-medium">Name</th>
                          <th className="py-1 text-left font-medium">SKU</th>
                          <th className="py-1 text-right font-medium">
                            Unit Price
                          </th>
                          <th className="py-1 text-right font-medium">Qty</th>
                          <th className="py-1 text-right font-medium">Total</th>
                          <th className="py-1 text-left font-medium">
                            Received
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-t border-border/60">
                            <td className="py-2">{item.name}</td>
                            <td className="py-2 text-muted-foreground">
                              {item.sku || "—"}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {formatCurrency(item.calculatedTotal)}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {item.isReceived
                                ? `${item.qtyReceived ?? 0} × ${item.count ?? "—"} ${item.units ?? ""} (${item.category ?? "—"})`
                                : "Not received"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ImportOrderPanel({
  onClose,
  suppliers,
}: {
  onClose: () => void;
  suppliers: { id: string; name: string }[];
}) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [dateOrdered, setDateOrdered] = useState(todayDateString());
  const [isDragging, setIsDragging] = useState(false);

  const createMutation = trpc.inventory.createOrder.useMutation({
    onSuccess: (data) => {
      utils.inventory.listOrders.invalidate();
      utils.inventory.listSuppliers.invalidate();
      toast.success(
        `Imported order with ${data.items.length} item${data.items.length !== 1 ? "s" : ""}`
      );
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV((e.target?.result as string) || "");
      setCsvData(parsed);
      const mfr = parsed
        .map((r) => getRowValue(r, "manufacturer", "supplier"))
        .find(Boolean);
      if (mfr) setSupplierName(mfr);
    };
    reader.readAsText(file);
  }, []);

  const mapped = (csvData ?? [])
    .map((row, index) => {
      const name = getRowValue(row, "name", "item", "description");
      const unitPriceRaw = getRowValue(row, "unitPrice", "unit_price", "price");
      const unitPrice = unitPriceRaw ? normalizePrice(unitPriceRaw) : null;
      const qtyRaw = getRowValue(row, "quantity", "qty", "stockQuantity");
      const quantity = qtyRaw ? parseInt(qtyRaw, 10) || 1 : 1;
      const csvTotalRaw = getRowValue(
        row,
        "totalPrice",
        "total_price",
        "total"
      );
      const csvTotal = csvTotalRaw ? normalizePrice(csvTotalRaw) : null;
      const errors: string[] = [];
      if (!name) errors.push("missing name");
      if (!unitPrice) errors.push("invalid unitPrice");
      return {
        rowNumber: index + 2,
        errors,
        item: {
          name,
          sku: getRowValue(row, "sku") || undefined,
          unitPrice: unitPrice ?? "",
          quantity,
          csvTotalPrice: csvTotal || undefined,
          manufacturer:
            getRowValue(row, "manufacturer", "supplier") || undefined,
        },
      };
    });

  const valid = mapped.filter((m) => m.errors.length === 0);

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Import order from CSV</h3>
          <p className="text-xs text-muted-foreground mt-1">
            One CSV creates one order. Columns: Item/Name, SKU, Manufacturer,
            Unit Price, Quantity, Total Price. Integer prices (Vetcove) are
            treated as cents.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={downloadOrderTemplateCSV}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Template
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-lg">
        <div>
          <label className="text-xs text-muted-foreground">Date Ordered</label>
          <DateField
            className="mt-1"
            value={dateOrdered}
            onChange={setDateOrdered}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Supplier</label>
          <div className="mt-1">
            <SupplierAutocomplete
              value={supplierName}
              onChange={setSupplierName}
              suppliers={suppliers}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file?.name.toLowerCase().endsWith(".csv")) handleFile(file);
          else toast.error("Please upload a .csv file");
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag and drop a CSV, or click to select
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {csvData && csvData.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Preview ({valid.length} valid of {csvData.length})
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {Object.keys(csvData[0]).map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Object.values(row).map((val, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 text-muted-foreground whitespace-nowrap"
                      >
                        {val || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            size="sm"
            disabled={createMutation.isPending || valid.length === 0}
            onClick={() =>
              createMutation.mutate({
                supplierName: supplierName || undefined,
                dateOrdered,
                importedFromCsv: true,
                items: valid.map((v) => v.item),
              })
            }
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Create Order ({valid.length} items)
          </Button>
        </div>
      )}
    </div>
  );
}

function NewOrderForm({
  onClose,
  suppliers,
}: {
  onClose: () => void;
  suppliers: { id: string; name: string }[];
}) {
  const utils = trpc.useUtils();
  const [supplierName, setSupplierName] = useState("");
  const [dateOrdered, setDateOrdered] = useState(todayDateString());
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unitPrice: "",
    quantity: 1,
  });

  const createMutation = trpc.inventory.createOrder.useMutation({
    onSuccess: () => {
      utils.inventory.listOrders.invalidate();
      utils.inventory.listSuppliers.invalidate();
      toast.success("Order created");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseFloat(form.unitPrice.replace(/[$,\s]/g, ""));
        if (isNaN(n) || n < 0) {
          toast.error("Invalid unit price");
          return;
        }
        createMutation.mutate({
          supplierName: supplierName || undefined,
          dateOrdered,
          items: [
            {
              name: form.name,
              sku: form.sku || undefined,
              unitPrice: n.toFixed(2),
              quantity: form.quantity,
              dateOrdered,
            },
          ],
        });
      }}
    >
      <h3 className="font-medium text-sm">New order</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Date Ordered</label>
          <DateField
            className="mt-1"
            value={dateOrdered}
            onChange={setDateOrdered}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Supplier</label>
          <div className="mt-1">
            <SupplierAutocomplete
              value={supplierName}
              onChange={setSupplierName}
              suppliers={suppliers}
            />
          </div>
        </div>
        <Input
          placeholder="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
        />
        <Input
          placeholder="Unit Price *"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          required
        />
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) =>
            setForm({ ...form, quantity: parseInt(e.target.value, 10) || 1 })
          }
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          Create Order
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type OrderItem = {
  id: string;
  name: string;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  sortOrder: number;
  csvTotalPrice: string | null;
  totalMismatch: boolean;
  calculatedTotal: string;
  dateOrdered: string;
  isReceived: boolean;
  dateReceived: string | null;
  category: string | null;
  qtyReceived: number | null;
  count: number | null;
  units: string | null;
  costPerCount: string | null;
  reorderPoint: number | null;
  lotNumber: string | null;
  expirationDate: string | null;
  lineComplete: boolean;
  linePartial: boolean;
};

function ActiveOrderCard({
  order,
  suppliers,
  showAddLine,
  onToggleAddLine,
  onChanged,
  csvLocked,
}: {
  order: {
    id: string;
    supplierName: string | null;
    dateOrdered: string;
    dateReceived: string | null;
    items: OrderItem[];
  };
  suppliers: { id: string; name: string }[];
  showAddLine: boolean;
  onToggleAddLine: () => void;
  onChanged: () => void;
  csvLocked: boolean;
}) {
  const utils = trpc.useUtils();
  const [doneErrors, setDoneErrors] = useState<string[] | null>(null);
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);

  const updateOrder = trpc.inventory.updateOrder.useMutation({
    onSuccess: () => {
      utils.inventory.listOrders.invalidate();
      utils.inventory.listSuppliers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const completeMutation = trpc.inventory.completeOrder.useMutation({
    onSuccess: (result) => {
      if (!result.ok) {
        if ("needsConfirmIncomplete" in result && result.needsConfirmIncomplete) {
          setConfirmIncomplete(true);
          return;
        }
        if (result.incompleteFields?.length) {
          setDoneErrors(
            result.incompleteFields.map(
              (f) => `${f.name}: missing ${f.missing.join(", ")}`
            )
          );
          return;
        }
      }
      utils.inventory.listOrders.invalidate();
      utils.inventory.list.invalidate();
      toast.success("Order archived");
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ordered</span>
          <DateField
            value={order.dateOrdered}
            onChange={(dateOrdered) =>
              updateOrder.mutate({ id: order.id, dateOrdered })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Date Received</span>
          <DateField
            allowEmpty
            value={order.dateReceived ?? ""}
            onChange={(dateReceived) =>
              updateOrder.mutate({
                id: order.id,
                dateReceived: dateReceived || null,
              })
            }
          />
        </div>
        <div className="w-48">
          <SupplierAutocomplete
            value={order.supplierName ?? ""}
            onChange={(supplierName) =>
              updateOrder.mutate({ id: order.id, supplierName })
            }
            suppliers={suppliers}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
        </p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={onToggleAddLine}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add line
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDoneErrors(null);
              completeMutation.mutate({ id: order.id });
            }}
            disabled={completeMutation.isPending}
          >
            {completeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Done"
            )}
          </Button>
        </div>
      </div>

      {doneErrors && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium mb-1">Complete these fields before Done:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {doneErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7"
            onClick={() => setDoneErrors(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {confirmIncomplete && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            Some lines are not fully received. Archive as incomplete anyway?
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setConfirmIncomplete(false);
                completeMutation.mutate({
                  id: order.id,
                  forceIncomplete: true,
                });
              }}
            >
              Archive incomplete
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmIncomplete(false)}
            >
              Keep working
            </Button>
          </div>
        </div>
      )}

      {showAddLine && (
        <AddLineForm
          orderId={order.id}
          dateOrdered={order.dateOrdered}
          onDone={() => {
            onToggleAddLine();
            utils.inventory.listOrders.invalidate();
          }}
        />
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              {[
                "Date Ordered",
                "Name",
                "SKU",
                "Unit Price",
                "Qty",
                "Total",
                "Received",
                "",
              ].map((h) => (
                <th
                  key={h || "actions"}
                  className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...order.items]
              .sort(
                (a, b) =>
                  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
                  a.id.localeCompare(b.id)
              )
              .map((item) => (
                <OrderItemRows
                  key={item.id}
                  item={item}
                  csvLocked={csvLocked}
                  orderDateReceived={order.dateReceived}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddLineForm({
  orderId,
  dateOrdered,
  onDone,
}: {
  orderId: string;
  dateOrdered: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    unitPrice: "",
    quantity: 1,
  });
  const addMutation = trpc.inventory.addOrderItem.useMutation({
    onSuccess: () => {
      toast.success("Line added");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="border-b border-border px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-2 bg-muted/10"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseFloat(form.unitPrice.replace(/[$,\s]/g, ""));
        if (isNaN(n) || n < 0) {
          toast.error("Invalid unit price");
          return;
        }
        addMutation.mutate({
          orderId,
          name: form.name,
          sku: form.sku || undefined,
          unitPrice: n.toFixed(2),
          quantity: form.quantity,
          dateOrdered,
        });
      }}
    >
      <Input
        placeholder="Name *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
        className="h-8"
      />
      <Input
        placeholder="SKU"
        value={form.sku}
        onChange={(e) => setForm({ ...form, sku: e.target.value })}
        className="h-8"
      />
      <Input
        placeholder="Unit Price *"
        value={form.unitPrice}
        onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
        required
        className="h-8"
      />
      <Input
        type="number"
        min={1}
        value={form.quantity}
        onChange={(e) =>
          setForm({ ...form, quantity: parseInt(e.target.value, 10) || 1 })
        }
        className="h-8"
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-8">
          Add
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function OrderItemRows({
  item,
  csvLocked,
  orderDateReceived,
}: {
  item: OrderItem;
  csvLocked: boolean;
  orderDateReceived: string | null;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(item.name);
  const [unitPrice, setUnitPrice] = useState(item.unitPrice);
  const [lotNumber, setLotNumber] = useState(item.lotNumber ?? "");
  const [dateReceived, setDateReceived] = useState(
    item.dateReceived ?? orderDateReceived ?? todayDateString()
  );
  const [expirationDate, setExpirationDate] = useState(
    item.expirationDate ?? ""
  );

  useEffect(() => {
    setName(item.name);
    setUnitPrice(item.unitPrice);
    setLotNumber(item.lotNumber ?? "");
    setDateReceived(
      item.dateReceived ?? orderDateReceived ?? todayDateString()
    );
    setExpirationDate(item.expirationDate ?? "");
  }, [
    item.name,
    item.unitPrice,
    item.lotNumber,
    item.dateReceived,
    item.expirationDate,
    orderDateReceived,
  ]);

  const updateMutation = trpc.inventory.updateOrderItem.useMutation({
    onSuccess: (updated) => {
      // Patch cache in place so typing isn't interrupted by a full list refetch.
      utils.inventory.listOrders.setData({ status: "active" }, (prev) => {
        if (!prev) return prev;
        return prev.map((order) => ({
          ...order,
          items: order.items.map((it) =>
            it.id === updated.id
              ? {
                  ...it,
                  ...updated,
                }
              : it
          ),
        }));
      });
      utils.inventory.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.inventory.deleteOrderItem.useMutation({
    onSuccess: () => {
      utils.inventory.listOrders.invalidate();
      utils.inventory.list.invalidate();
      toast.success("Line removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const save = (
    patch: Omit<Parameters<typeof updateMutation.mutate>[0], "id">
  ) => {
    updateMutation.mutate({ id: item.id, ...patch });
  };

  const costPreview =
    item.count && item.count > 0
      ? calcCostPerCount(item.unitPrice, item.quantity, item.count)
      : item.costPerCount;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border",
          item.totalMismatch && "bg-amber-50/80"
        )}
      >
        <td className="px-3 py-2 whitespace-nowrap">
          {csvLocked ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {item.dateOrdered}
            </span>
          ) : (
            <DateField
              value={item.dateOrdered}
              onChange={(dateOrdered) => save({ dateOrdered })}
            />
          )}
        </td>
        <td className="px-3 py-2">
          {csvLocked ? (
            <span className="text-sm font-medium">{item.name}</span>
          ) : (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name !== item.name) {
                  save({ name: name.trim() });
                }
              }}
              className="h-8 text-sm min-w-[140px]"
            />
          )}
        </td>
        <td className="px-3 py-2 text-muted-foreground">
          {item.sku || "—"}
        </td>
        <td className="px-3 py-2">
          {csvLocked ? (
            <span className="tabular-nums text-sm">
              {formatCurrency(item.unitPrice)}
            </span>
          ) : (
            <Input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              onBlur={() => {
                const n = parseFloat(unitPrice.replace(/[$,\s]/g, ""));
                if (isNaN(n)) return;
                const next = n.toFixed(2);
                if (next !== item.unitPrice) {
                  save({ unitPrice: next });
                  setUnitPrice(next);
                }
              }}
              className="h-8 text-sm w-24"
            />
          )}
        </td>
        <td className="px-3 py-2">
          {csvLocked ? (
            <span className="tabular-nums text-sm">{item.quantity}</span>
          ) : (
            <DigitsField
              value={item.quantity}
              emptyAs={1}
              onCommit={(next) => {
                if (next != null && next >= 1) save({ quantity: next });
              }}
              className="h-8 w-16 px-1.5 text-sm"
            />
          )}
        </td>
        <td
          className={cn(
            "px-3 py-2 tabular-nums",
            item.totalMismatch && "font-medium text-amber-800"
          )}
          title={
            item.totalMismatch
              ? `CSV total ${formatCurrency(item.csvTotalPrice)} differs from calculated`
              : undefined
          }
        >
          {formatCurrency(item.calculatedTotal)}
          {item.totalMismatch && (
            <span className="ml-1 text-xs">(≠ CSV)</span>
          )}
        </td>
        <td className="px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={item.isReceived}
              onChange={(e) => {
                const checked = e.target.checked;
                if (checked) {
                  const next =
                    orderDateReceived || todayDateString();
                  setDateReceived(next);
                  save({ isReceived: true, dateReceived: next });
                } else {
                  save({ isReceived: false });
                }
              }}
            />
            Received
          </label>
        </td>
        <td className="px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            onClick={() => {
              if (confirm("Remove this line?")) {
                deleteMutation.mutate({ id: item.id });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>
      {item.isReceived && (
        <tr className="border-b border-border bg-muted/20">
          <td colSpan={8} className="px-3 py-2">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Date Received
                </label>
                <DateField
                  className="mt-0.5"
                  value={dateReceived}
                  onChange={(next) => {
                    setDateReceived(next);
                    save({ dateReceived: next || null });
                  }}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Category
                </label>
                <select
                  value={item.category ?? ""}
                  onChange={(e) =>
                    save({
                      category: (e.target.value || null) as
                        | "medication"
                        | "vaccine"
                        | "preventive"
                        | "supplement"
                        | "food"
                        | "supply"
                        | null,
                    })
                  }
                  className={cn(dateSelectClass, "mt-0.5 w-[7.5rem]")}
                >
                  <option value="">Select</option>
                  {CATEGORIES.slice(1).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Qty Recv
                </label>
                <DigitsField
                  value={item.qtyReceived ?? item.quantity}
                  emptyAs={item.quantity}
                  onCommit={(next) => {
                    if (next != null) save({ qtyReceived: next });
                  }}
                  className="mt-0.5 h-8 w-14 px-1.5 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">Count</label>
                <DigitsField
                  value={item.count}
                  allowEmpty
                  onCommit={(next) => save({ count: next })}
                  className="mt-0.5 h-8 w-14 px-1.5 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">Units</label>
                <select
                  value={item.units ?? ""}
                  onChange={(e) =>
                    save({
                      units: (e.target.value || null) as
                        | (typeof UNIT_OPTIONS)[number]
                        | null,
                    })
                  }
                  className={cn(dateSelectClass, "mt-0.5 w-[5.5rem]")}
                >
                  <option value="">Select</option>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Cost/ct
                </label>
                <Input
                  value={costPreview ? formatCurrency(costPreview) : "—"}
                  readOnly
                  className="mt-0.5 h-8 w-[4.5rem] px-1.5 text-sm bg-muted/50"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Reorder
                </label>
                <DigitsField
                  value={item.reorderPoint}
                  allowEmpty
                  onCommit={(next) => save({ reorderPoint: next })}
                  className="mt-0.5 h-8 w-14 px-1.5 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">Lot #</label>
                <Input
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  onBlur={() => {
                    if (lotNumber !== (item.lotNumber ?? "")) {
                      save({ lotNumber: lotNumber || null });
                    }
                  }}
                  className="mt-0.5 h-8 w-[calc(12ch+0.75rem)] px-1.5 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[11px] text-muted-foreground">
                  Expiration
                </label>
                <DateField
                  className="mt-0.5"
                  allowEmpty
                  value={expirationDate}
                  onChange={(next) => {
                    setExpirationDate(next);
                    save({ expirationDate: next || null });
                  }}
                />
              </div>
            </div>
            {item.linePartial && (
              <p className="mt-2 text-xs text-amber-700">
                Partial receive: {item.qtyReceived} of {item.quantity} ordered.
                Remainder can be received later, or mark Done as incomplete.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// --- Suppliers tab ---

function SuppliersTab() {
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const suppliersQuery = trpc.inventory.listSuppliers.useQuery();

  return (
    <>
      <div className="mt-4 flex items-center justify-between">
        {suppliersQuery.data && (
          <p className="text-sm text-muted-foreground">
            {suppliersQuery.data.length} supplier
            {suppliersQuery.data.length !== 1 ? "s" : ""}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null);
            setShowAdd(true);
          }}
          className="ml-auto"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Supplier
        </Button>
      </div>

      {showAdd && (
        <AddSupplierForm
          onClose={() => {
            setShowAdd(false);
            utils.inventory.listSuppliers.invalidate();
          }}
        />
      )}

      {suppliersQuery.isLoading ? (
        <div className="mt-6 text-center text-muted-foreground">Loading...</div>
      ) : suppliersQuery.data && suppliersQuery.data.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Phone
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Address
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Notes
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliersQuery.data.map((supplier) =>
                editingId === supplier.id ? (
                  <EditSupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    onClose={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={supplier.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{supplier.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.contactEmail || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.address || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[12rem] truncate">
                      {supplier.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setShowAdd(false);
                          setEditingId(supplier.id);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Truck className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">No suppliers yet</p>
        </div>
      )}
    </>
  );
}

function EditSupplierRow({
  supplier,
  onClose,
}: {
  supplier: {
    id: string;
    name: string;
    contactEmail: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.inventory.updateSupplier.useMutation({
    onSuccess: () => {
      utils.inventory.listSuppliers.invalidate();
      utils.inventory.list.invalidate();
      utils.inventory.listOrders.invalidate();
      onClose();
      toast.success("Supplier updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({
    name: supplier.name,
    contactEmail: supplier.contactEmail ?? "",
    phone: supplier.phone ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  });

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-3 py-2">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-sm"
          required
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={updateMutation.isPending || !form.name.trim()}
            onClick={() =>
              updateMutation.mutate({
                id: supplier.id,
                name: form.name.trim(),
                contactEmail: form.contactEmail.trim() || "",
                phone: form.phone.trim() || null,
                address: form.address.trim() || null,
                notes: form.notes.trim() || null,
              })
            }
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddSupplierForm({ onClose }: { onClose: () => void }) {
  const createMutation = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => {
      toast.success("Supplier added");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    phone: "",
    address: "",
    notes: "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createMutation.mutate({
          name: form.name,
          contactEmail: form.contactEmail || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        });
      }}
      className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium text-sm">Add Supplier</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Input
          placeholder="Name *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="Email"
          type="email"
          value={form.contactEmail}
          onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
        />
        <Input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="col-span-2"
        />
        <Input
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          Add Supplier
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// --- Main ---

export default function InventoryPage() {
  const [tab, setTab] = useState<MainTab>("products");

  const tabs: { id: MainTab; label: string; icon: typeof Package }[] = [
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ClipboardList },
    { id: "suppliers", label: "Suppliers", icon: Truck },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            On-hand products, orders & receiving, and suppliers
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab />}
      {tab === "orders" && <OrdersTab />}
      {tab === "suppliers" && <SuppliersTab />}
    </div>
  );
}
