"use client";

import { useState, useRef, useCallback } from "react";
import {
  Search,
  Package,
  Plus,
  Minus,
  Pencil,
  Truck,
  X,
  Check,
  Trash2,
  Upload,
  Download,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { label: "All Categories", value: "" },
  { label: "Medication", value: "medication" },
  { label: "Preventive", value: "preventive" },
  { label: "Supplement", value: "supplement" },
  { label: "Food", value: "food" },
  { label: "Supply", value: "supply" },
] as const;

const CSV_TEMPLATE_HEADERS = [
  "name",
  "sku",
  "category",
  "unitPrice",
  "costPrice",
  "stockQuantity",
  "reorderPoint",
  "lotNumber",
  "expirationDate",
] as const;

const VALID_CATEGORIES = new Set(
  CATEGORIES.slice(1).map((c) => c.value)
);

function formatCurrency(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return `$${num.toFixed(2)}`;
}

function isExpiringSoon(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  const expDate = new Date(expirationDate);
  const now = new Date();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  return expDate.getTime() - now.getTime() <= ninetyDays;
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

function downloadTemplateCSV() {
  const sample = [
    CSV_TEMPLATE_HEADERS.join(","),
    "Rimadyl 100mg,RIM-100,medication,45.00,22.50,50,10,LOT123,2027-06-01",
    "Heartgard Plus,HG-PLUS,preventive,32.00,15.00,25,5,,",
  ].join("\n");
  const blob = new Blob([sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function getRowValue(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const match = Object.entries(row).find(
      ([k]) => k.toLowerCase().replace(/[_\s]/g, "") === key.toLowerCase().replace(/[_\s]/g, "")
    );
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

// --- Add Product Form ---

function AddProductForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success("Product added");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unitPrice: "",
    costPrice: "",
    stockQuantity: 0,
    reorderPoint: 10,
    lotNumber: "",
    expirationDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      sku: form.sku || undefined,
      category: form.category || undefined,
      unitPrice: form.unitPrice,
      costPrice: form.costPrice || undefined,
      stockQuantity: form.stockQuantity,
      reorderPoint: form.reorderPoint,
      lotNumber: form.lotNumber || undefined,
      expirationDate: form.expirationDate || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3"
    >
      <h3 className="font-medium text-sm">Add Product</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Category</option>
          {CATEGORIES.slice(1).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="Unit Price *"
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          required
        />
        <Input
          placeholder="Cost Price"
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Stock Qty"
          value={form.stockQuantity}
          onChange={(e) =>
            setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })
          }
        />
        <Input
          type="number"
          placeholder="Reorder Point"
          value={form.reorderPoint}
          onChange={(e) =>
            setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })
          }
        />
        <Input
          placeholder="Lot Number"
          value={form.lotNumber}
          onChange={(e) => setForm({ ...form, lotNumber: e.target.value })}
        />
        <Input
          type="date"
          placeholder="Expiration Date"
          value={form.expirationDate}
          onChange={(e) =>
            setForm({ ...form, expirationDate: e.target.value })
          }
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Adding..." : "Add Product"}
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

// --- Edit Product Form ---

function EditProductRow({
  product,
  onClose,
}: {
  product: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    unitPrice: string;
    costPrice: string | null;
    stockQuantity: number;
    reorderPoint: number | null;
    lotNumber: string | null;
    expirationDate: string | null;
  };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success("Product updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: product.name,
    sku: product.sku ?? "",
    category: product.category ?? "",
    unitPrice: product.unitPrice,
    costPrice: product.costPrice ?? "",
    reorderPoint: product.reorderPoint ?? 10,
    lotNumber: product.lotNumber ?? "",
    expirationDate: product.expirationDate ?? "",
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: product.id,
      name: form.name,
      sku: form.sku || undefined,
      category: form.category || undefined,
      unitPrice: form.unitPrice,
      costPrice: form.costPrice || undefined,
      reorderPoint: form.reorderPoint,
      lotNumber: form.lotNumber || undefined,
      expirationDate: form.expirationDate || null,
    });
  };

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-4 py-2">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="h-8 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm w-full"
        >
          <option value="">--</option>
          {CATEGORIES.slice(1).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <Input
          value={form.unitPrice}
          onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          className="h-8 text-sm text-right"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={form.costPrice}
          onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
          className="h-8 text-sm text-right"
        />
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {product.stockQuantity}
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          value={form.reorderPoint}
          onChange={(e) =>
            setForm({ ...form, reorderPoint: parseInt(e.target.value) || 0 })
          }
          className="h-8 text-sm text-right w-20"
        />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={handleSave}
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

// --- Stock Adjust Popover ---

function StockAdjustPopover({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const adjustMutation = trpc.inventory.adjustStock.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      onClose();
      toast.success("Stock adjusted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");

  const handleAdjust = (direction: 1 | -1) => {
    if (!reason.trim()) return;
    adjustMutation.mutate({
      id: productId,
      adjustment: qty * direction,
      reason: reason.trim(),
    });
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Adjust stock: {productName}
      </p>
      <Input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
        className="h-8 text-sm mb-2"
        placeholder="Quantity"
      />
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-8 text-sm mb-2"
        placeholder="Reason *"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => handleAdjust(1)}
          disabled={adjustMutation.isPending || !reason.trim()}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={() => handleAdjust(-1)}
          disabled={adjustMutation.isPending || !reason.trim()}
        >
          <Minus className="h-3 w-3 mr-1" /> Remove
        </Button>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2 w-full h-7 text-xs"
        onClick={onClose}
      >
        Cancel
      </Button>
      {adjustMutation.error && (
        <p className="text-xs text-destructive mt-1">
          {adjustMutation.error.message}
        </p>
      )}
    </div>
  );
}

// --- Import CSV Panel ---

function ImportProductsPanel({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const importMutation = trpc.inventory.importProducts.useMutation({
    onSuccess: (data) => {
      utils.inventory.list.invalidate();
      toast.success(`Imported ${data.imported} product${data.imported !== 1 ? "s" : ""}`);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    setParseErrors([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setCsvData(null);
        setParseErrors(["CSV must include a header row and at least one data row."]);
        return;
      }
      setCsvData(parsed);
    };
    reader.readAsText(file);
  }, []);

  const mappedProducts = (csvData ?? [])
    .map((row, index) => {
      const name = getRowValue(row, "name");
      const unitPrice = getRowValue(row, "unitPrice", "unit_price", "price");
      const categoryRaw = getRowValue(row, "category").toLowerCase();
      const stockRaw = getRowValue(row, "stockQuantity", "stock_quantity", "stock");
      const reorderRaw = getRowValue(row, "reorderPoint", "reorder_point", "reorder");
      const costPrice = getRowValue(row, "costPrice", "cost_price", "cost");
      const sku = getRowValue(row, "sku");
      const lotNumber = getRowValue(row, "lotNumber", "lot_number", "lot");
      const expirationDate = getRowValue(
        row,
        "expirationDate",
        "expiration_date",
        "expiration"
      );

      const errors: string[] = [];
      if (!name) errors.push("missing name");
      if (!unitPrice || isNaN(parseFloat(unitPrice)) || parseFloat(unitPrice) < 0) {
        errors.push("invalid unitPrice");
      }
      if (categoryRaw && !VALID_CATEGORIES.has(categoryRaw)) {
        errors.push(`invalid category "${categoryRaw}"`);
      }

      return {
        rowNumber: index + 2,
        errors,
        product: {
          name,
          sku: sku || undefined,
          category: categoryRaw && VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : undefined,
          unitPrice,
          costPrice: costPrice || undefined,
          stockQuantity: stockRaw ? parseInt(stockRaw, 10) || 0 : 0,
          reorderPoint: reorderRaw ? parseInt(reorderRaw, 10) || 10 : 10,
          lotNumber: lotNumber || undefined,
          expirationDate: expirationDate || undefined,
        },
      };
    });

  const validProducts = mappedProducts.filter((p) => p.errors.length === 0);
  const invalidProducts = mappedProducts.filter((p) => p.errors.length > 0);

  const handleImport = () => {
    if (validProducts.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    importMutation.mutate({
      products: validProducts.map((p) => p.product),
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Import Products from CSV</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Expected columns: name, sku, category, unitPrice, costPrice,
            stockQuantity, reorderPoint, lotNumber, expirationDate
          </p>
          <p className="text-xs text-muted-foreground">
            Categories: medication, preventive, supplement, food, supply
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadTemplateCSV}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Template
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
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
          if (file && file.name.toLowerCase().endsWith(".csv")) {
            handleFileSelect(file);
          } else {
            toast.error("Please upload a .csv file");
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Drag and drop a CSV file here, or click to select
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
      </div>

      {parseErrors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {parseErrors.join(" ")}
        </div>
      )}

      {csvData && csvData.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Preview ({csvData.length} rows, {validProducts.length} valid
            {invalidProducts.length > 0
              ? `, ${invalidProducts.length} with errors`
              : ""}
            )
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {Object.keys(csvData[0]).map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-medium whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
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

          {invalidProducts.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-medium">Rows that will be skipped:</p>
              {invalidProducts.slice(0, 8).map((row) => (
                <p key={row.rowNumber}>
                  Row {row.rowNumber}: {row.errors.join(", ")}
                </p>
              ))}
              {invalidProducts.length > 8 && (
                <p>...and {invalidProducts.length - 8} more</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={importMutation.isPending || validProducts.length === 0}
              onClick={handleImport}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Import {validProducts.length} Product
              {validProducts.length !== 1 ? "s" : ""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCsvData(null);
                setParseErrors([]);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Add Supplier Form ---

function AddSupplierForm({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createMutation = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => {
      utils.inventory.listSuppliers.invalidate();
      onClose();
      toast.success("Supplier added");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    phone: "",
    address: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      contactEmail: form.contactEmail || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
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
          {createMutation.isPending ? "Adding..." : "Add Supplier"}
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

// --- Main Page ---

export default function InventoryPage() {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"products" | "suppliers">("products");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const productsQuery = trpc.inventory.list.useQuery(
    {
      search: search || undefined,
      category: category || undefined,
      limit: 100,
      offset: 0,
    },
    { enabled: tab === "products" }
  );

  const suppliersQuery = trpc.inventory.listSuppliers.useQuery(undefined, {
    enabled: tab === "suppliers",
  });

  const deleteMutation = trpc.inventory.delete.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      toast.success("Product deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleDelete = (product: { id: string; name: string }) => {
    if (
      !confirm(
        `Delete "${product.name}"? This removes it from inventory.`
      )
    ) {
      return;
    }
    deleteMutation.mutate({ id: product.id });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Inventory</h2>
          <p className="text-sm text-muted-foreground">
            Products, stock management, and suppliers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("products")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "products"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="h-4 w-4" />
          Products
        </button>
        <button
          onClick={() => setTab("suppliers")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "suppliers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Truck className="h-4 w-4" />
          Suppliers
        </button>
      </div>

      {/* Products Tab */}
      {tab === "products" && (
        <>
          <div className="mt-4 flex items-center gap-4">
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
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {productsQuery.data && (
              <p className="text-sm text-muted-foreground">
                {productsQuery.data.total} product
                {productsQuery.data.total !== 1 ? "s" : ""}
              </p>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowImport(true);
                  setShowAddProduct(false);
                }}
              >
                <Upload className="h-4 w-4 mr-1" /> Import CSV
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowAddProduct(true);
                  setShowImport(false);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Product
              </Button>
            </div>
          </div>

          {showImport && (
            <ImportProductsPanel onClose={() => setShowImport(false)} />
          )}

          {showAddProduct && (
            <AddProductForm onClose={() => setShowAddProduct(false)} />
          )}

          {productsQuery.error && (
            <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {productsQuery.error.message}
            </div>
          )}

          {productsQuery.isLoading ? (
            <div className="mt-6 text-center text-muted-foreground">
              Loading...
            </div>
          ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Reorder Pt
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productsQuery.data.items.map((product) => {
                    if (editingId === product.id) {
                      return (
                        <EditProductRow
                          key={product.id}
                          product={product}
                          onClose={() => setEditingId(null)}
                        />
                      );
                    }

                    const isLowStock = product.stockStatus === "low";
                    const expiringSoon = isExpiringSoon(product.expirationDate);

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {product.sku || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {product.category || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatCurrency(product.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {product.costPrice
                            ? formatCurrency(product.costPrice)
                            : "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {product.stockQuantity}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {product.reorderPoint ?? "\u2014"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                isLowStock
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              )}
                            >
                              {isLowStock ? "Low Stock" : "In Stock"}
                            </span>
                            {expiringSoon && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                                Expiring Soon
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditingId(product.id)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() =>
                                setAdjustingId(
                                  adjustingId === product.id
                                    ? null
                                    : product.id
                                )
                              }
                              title="Adjust Stock"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(product)}
                              disabled={deleteMutation.isPending}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {adjustingId === product.id && (
                              <StockAdjustPopover
                                productId={product.id}
                                productName={product.name}
                                onClose={() => setAdjustingId(null)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                {search || category
                  ? "No products match your filters"
                  : "No products yet"}
              </p>
            </div>
          )}
        </>
      )}

      {/* Suppliers Tab */}
      {tab === "suppliers" && (
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
              onClick={() => setShowAddSupplier(true)}
              className="ml-auto"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Supplier
            </Button>
          </div>

          {showAddSupplier && (
            <AddSupplierForm onClose={() => setShowAddSupplier(false)} />
          )}

          {suppliersQuery.error && (
            <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              {suppliersQuery.error.message}
            </div>
          )}

          {suppliersQuery.isLoading ? (
            <div className="mt-6 text-center text-muted-foreground">
              Loading...
            </div>
          ) : suppliersQuery.data && suppliersQuery.data.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
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
                  </tr>
                </thead>
                <tbody>
                  {suppliersQuery.data.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {supplier.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.contactEmail || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.phone || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {supplier.address || "\u2014"}
                      </td>
                    </tr>
                  ))}
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
      )}
    </div>
  );
}
