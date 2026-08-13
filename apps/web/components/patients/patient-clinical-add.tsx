"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toKgString, useWeightUnit, type WeightUnit } from "@/lib/weight-units";
import { addDueInterval, formatDueInterval } from "@/lib/due-interval";
import { planDisplayName } from "@/lib/plan-name";
import {
  ProductPicker,
  StockUseFields,
  type CatalogProduct,
} from "@/components/inventory/product-picker";

type FormKind =
  | "weight"
  | "vaccination"
  | "prescription"
  | "problem"
  | "supply"
  | null;

export function toastStock(result?: {
  stockWarned?: boolean;
  stockBalanceAfter?: number;
  warned?: boolean;
  balanceAfter?: number;
  stockWarnings?: Array<{ name: string; balanceAfter: number }>;
}) {
  if (result?.stockWarnings && result.stockWarnings.length > 0) {
    for (const warning of result.stockWarnings) {
      toast.warning(
        `${warning.name} stock is now ${warning.balanceAfter} (below zero)`
      );
    }
    return;
  }
  const warned = result?.stockWarned || result?.warned;
  const balance = result?.stockBalanceAfter ?? result?.balanceAfter;
  if (warned) {
    toast.warning(`Stock is now ${balance} (below zero)`);
  }
}

export function PatientClinicalAdd({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [openForm, setOpenForm] = useState<FormKind>(null);
  const utils = trpc.useUtils();

  const invalidate = () => {
    utils.records.listVaccinations.invalidate({ patientId });
    utils.records.listPrescriptions.invalidate({ patientId });
    utils.records.listProblems.invalidate({ patientId });
    utils.patients.getById.invalidate({ id: patientId });
  };

  const addWeight = trpc.patients.addWeight.useMutation({
    onSuccess: () => {
      toast.success("Weight recorded");
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createVaccination = trpc.records.createVaccination.useMutation({
    onSuccess: (result) => {
      toast.success("Vaccination recorded");
      toastStock(result);
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createPrescription = trpc.records.createPrescription.useMutation({
    onSuccess: (result) => {
      toast.success("Prescription added");
      toastStock(result);
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const recordSupply = trpc.inventory.recordUsage.useMutation({
    onSuccess: (result) => {
      toast.success("Supply used");
      toastStock(result);
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createProblem = trpc.records.createProblem.useMutation({
    onSuccess: () => {
      toast.success("Problem added");
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Add clinical record</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => router.push(`/records/new-soap/${patientId}`)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            SOAP
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "weight" ? "default" : "outline"}
            onClick={() =>
              setOpenForm(openForm === "weight" ? null : "weight")
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Weight
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "vaccination" ? "default" : "outline"}
            onClick={() =>
              setOpenForm(openForm === "vaccination" ? null : "vaccination")
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Vaccine
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "prescription" ? "default" : "outline"}
            onClick={() =>
              setOpenForm(openForm === "prescription" ? null : "prescription")
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Medication
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "supply" ? "default" : "outline"}
            onClick={() => setOpenForm(openForm === "supply" ? null : "supply")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Supply
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "problem" ? "default" : "outline"}
            onClick={() => setOpenForm(openForm === "problem" ? null : "problem")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Problem
          </Button>
        </div>
      </div>

      {openForm === "weight" && (
        <WeightForm
          onSubmit={(weightKg) => addWeight.mutate({ patientId, weightKg })}
          loading={addWeight.isPending}
        />
      )}
      {openForm === "vaccination" && (
        <VaccinationForm
          onSubmit={(data) => createVaccination.mutate({ patientId, ...data })}
          loading={createVaccination.isPending}
        />
      )}
      {openForm === "prescription" && (
        <PrescriptionForm
          onSubmit={(data) => createPrescription.mutate({ patientId, ...data })}
          loading={createPrescription.isPending}
        />
      )}
      {openForm === "supply" && (
        <SupplyForm
          onSubmit={(data) =>
            recordSupply.mutate({
              patientId,
              productId: data.productId,
              quantity: data.quantity,
              sourceType: "supply",
              note: data.stockNote,
            })
          }
          loading={recordSupply.isPending}
        />
      )}
      {openForm === "problem" && (
        <ProblemForm
          onSubmit={(data) => createProblem.mutate({ patientId, ...data })}
          loading={createProblem.isPending}
        />
      )}
    </div>
  );
}

function WeightForm({
  onSubmit,
  loading,
}: {
  onSubmit: (weightKg: string) => void;
  loading: boolean;
}) {
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useWeightUnit();

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const kg = toKgString(weight, unit);
        if (!kg) return;
        onSubmit(kg);
      }}
    >
      <div className="min-w-[12rem] flex-1">
        <label className="mb-1 block text-xs font-medium">
          Weight ({unit})
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={unit === "lb" ? "e.g. 31.3" : "e.g. 14.2"}
            required
          />
          <UnitToggle unit={unit} onChange={setUnit} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving..." : "Save weight"}
      </Button>
    </form>
  );
}

export function UnitToggle({
  unit,
  onChange,
  className,
}: {
  unit: WeightUnit;
  onChange: (next: WeightUnit) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Weight unit"
      className={cn(
        "inline-flex h-9 shrink-0 overflow-hidden rounded-md border border-input bg-background text-xs font-medium",
        className
      )}
    >
      {(["kg", "lb"] as const).map((value) => {
        const active = unit === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={active}
            className={cn(
              "px-3 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

type ExtraStockItem = {
  key: string;
  product: CatalogProduct | null;
  quantity: number;
};

export function VaccinationForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    vaccineName: string;
    lotNumber?: string;
    administeredAt?: string;
    nextDueDate?: string;
    notes?: string;
    manufacturer?: string;
    kitId?: string;
    productId?: string;
    quantity?: number;
    stockNote?: string;
    extraItems?: Array<{
      productId: string;
      quantity: number;
      note?: string;
    }>;
  }) => void;
  loading: boolean;
}) {
  const { data: kits } = trpc.inventoryKits.list.useQuery();
  const activeKits = (kits ?? []).filter((kit) => kit.isActive);
  const [kitId, setKitId] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [administeredAt, setAdministeredAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [stockNote, setStockNote] = useState("");
  const [extras, setExtras] = useState<ExtraStockItem[]>([]);

  const selectedKit = activeKits.find((kit) => kit.id === kitId);
  const kitDueLabel = selectedKit
    ? formatDueInterval(selectedKit.dueIntervalValue, selectedKit.dueIntervalUnit)
    : null;

  useEffect(() => {
    if (!selectedKit?.dueIntervalValue || !selectedKit.dueIntervalUnit) return;
    const due = addDueInterval(
      administeredAt,
      selectedKit.dueIntervalValue,
      selectedKit.dueIntervalUnit
    );
    if (due) setNextDueDate(due);
  }, [
    administeredAt,
    selectedKit?.id,
    selectedKit?.dueIntervalValue,
    selectedKit?.dueIntervalUnit,
  ]);

  function applyKit(id: string) {
    setKitId(id);
    const kit = activeKits.find((row) => row.id === id);
    if (!kit) {
      setProduct(null);
      return;
    }
    const first = kit.items[0];
    if (first) {
      setVaccineName(
        planDisplayName(
          kit.planName,
          planDisplayName(first.productPlanName, first.productName)
        )
      );
      if (first.productLotNumber) setLotNumber(first.productLotNumber);
    } else if (kit.planName) {
      setVaccineName(kit.planName);
    }
    setProduct(null);
    const due = addDueInterval(
      administeredAt,
      kit.dueIntervalValue,
      kit.dueIntervalUnit
    );
    setNextDueDate(due ?? "");
  }

  function addExtra() {
    setExtras((prev) => [
      ...prev,
      { key: crypto.randomUUID(), product: null, quantity: 1 },
    ]);
  }

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!vaccineName.trim()) return;
        const extraItems = extras
          .filter((row) => row.product)
          .map((row) => ({
            productId: row.product!.id,
            quantity: row.quantity,
          }));
        onSubmit({
          vaccineName: vaccineName.trim(),
          lotNumber: lotNumber || undefined,
          manufacturer: manufacturer || undefined,
          administeredAt: administeredAt || undefined,
          nextDueDate: nextDueDate || undefined,
          notes: notes || undefined,
          kitId: kitId || undefined,
          productId: kitId ? undefined : product?.id,
          quantity: kitId || !product ? undefined : quantity,
          stockNote: kitId || !product ? undefined : stockNote || undefined,
          extraItems: extraItems.length > 0 ? extraItems : undefined,
        });
      }}
    >
      {activeKits.length > 0 && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">
            Inventory kit
          </label>
          <select
            value={kitId}
            onChange={(e) => applyKit(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">None — enter manually</option>
            {activeKits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {selectedKit && (
        <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <p className="font-medium">Deducts from inventory</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {selectedKit.items.map((item) => (
              <li key={item.id}>
                {item.quantity}× {item.productName}
                {item.note ? ` (${item.note})` : ""}
                {item.stockQuantity != null
                  ? ` · on hand ${item.stockQuantity}`
                  : ""}
              </li>
            ))}
            {extras
              .filter((row) => row.product)
              .map((row) => (
                <li key={row.key}>
                  {row.quantity}× {row.product!.name}
                  {row.product!.stockQuantity != null
                    ? ` · on hand ${row.product!.stockQuantity}`
                    : ""}
                </li>
              ))}
          </ul>
        </div>
      )}
      {kitId && (
        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium">
              Additional inventory (optional)
            </label>
            <Button type="button" size="sm" variant="outline" onClick={addExtra}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add item
            </Button>
          </div>
          {extras.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Use this to deduct a different needle, syringe, or other item
              along with the kit.
            </p>
          )}
          {extras.map((row) => (
            <div
              key={row.key}
              className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_5.5rem_auto]"
            >
              <ProductPicker
                value={row.product}
                placeholder="Search extra inventory item..."
                onChange={(p) =>
                  setExtras((prev) =>
                    prev.map((item) =>
                      item.key === row.key ? { ...item, product: p } : item
                    )
                  )
                }
              />
              <Input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) =>
                  setExtras((prev) =>
                    prev.map((item) =>
                      item.key === row.key
                        ? {
                            ...item,
                            quantity: Math.max(
                              1,
                              parseInt(e.target.value, 10) || 1
                            ),
                          }
                        : item
                    )
                  )
                }
                aria-label="Quantity"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setExtras((prev) => prev.filter((item) => item.key !== row.key))
                }
              >
                Remove
              </Button>
              {row.product && row.quantity > row.product.stockQuantity && (
                <p className="text-xs text-amber-700 sm:col-span-3">
                  On hand is {row.product.stockQuantity}
                  {row.product.units ? ` ${row.product.units}` : ""}. Saving
                  will take stock negative.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {!kitId && (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">
            Inventory product (optional)
          </label>
          <ProductPicker
            value={product}
            placeholder="Link a catalog vaccine to decrement stock..."
            onChange={(p) => {
              setProduct(p);
              if (p) {
                setVaccineName(planDisplayName(p.planName, p.name));
                if (p.lotNumber) setLotNumber(p.lotNumber);
              }
            }}
          />
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Vaccine name</label>
        <Input
          value={vaccineName}
          onChange={(e) => setVaccineName(e.target.value)}
          placeholder="e.g. Rabies"
          required
        />
      </div>
      {!kitId && (
      <StockUseFields
        product={product}
        quantity={quantity}
        onQuantityChange={setQuantity}
        note={stockNote}
        onNoteChange={setStockNote}
      />
      )}
      <div>
        <label className="mb-1 block text-xs font-medium">Date given</label>
        <Input
          type="date"
          value={administeredAt}
          onChange={(e) => setAdministeredAt(e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Lot number</label>
        <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Next due</label>
        <Input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
        />
        {kitDueLabel && (
          <p className="mt-1 text-xs text-muted-foreground">
            From kit protocol: {kitDueLabel}
          </p>
        )}
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Notes</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save vaccination"}
        </Button>
      </div>
    </form>
  );
}

export function PrescriptionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    medicationName: string;
    dosage: string;
    frequency: string;
    startDate: string;
    instructions?: string;
    productId?: string;
    quantity?: number;
    stockNote?: string;
    administeredAt?: string;
  }) => void;
  loading: boolean;
}) {
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [instructions, setInstructions] = useState("");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [stockNote, setStockNote] = useState("");

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!medicationName.trim() || !dosage.trim() || !frequency.trim())
          return;
        onSubmit({
          medicationName: medicationName.trim(),
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          startDate,
          instructions: instructions || undefined,
          productId: product?.id,
          quantity: product ? quantity : undefined,
          stockNote: product ? stockNote || undefined : undefined,
          administeredAt: product ? new Date().toISOString() : undefined,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">
          Inventory product (optional)
        </label>
        <ProductPicker
          value={product}
          placeholder="Link a catalog medication to decrement stock..."
            onChange={(p) => {
            setProduct(p);
            if (p) setMedicationName(planDisplayName(p.planName, p.name));
          }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Medication</label>
        <Input
          value={medicationName}
          onChange={(e) => setMedicationName(e.target.value)}
          required
        />
      </div>
      <StockUseFields
        product={product}
        quantity={quantity}
        onQuantityChange={setQuantity}
        note={stockNote}
        onNoteChange={setStockNote}
      />
      <div>
        <label className="mb-1 block text-xs font-medium">Dosage</label>
        <Input value={dosage} onChange={(e) => setDosage(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Frequency</label>
        <Input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Start date</label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Instructions</label>
        <Input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save prescription"}
        </Button>
      </div>
    </form>
  );
}

function ProblemForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { description: string; status?: "active" | "chronic" }) => void;
  loading: boolean;
}) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "chronic">("active");

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!description.trim()) return;
        onSubmit({ description: description.trim(), status });
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Chronic otitis"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "chronic")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="chronic">Chronic</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving..." : "Save problem"}
      </Button>
    </form>
  );
}

export function SupplyForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    productId: string;
    productName: string;
    quantity: number;
    units?: string | null;
    stockNote?: string;
  }) => void;
  loading: boolean;
}) {
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [planName, setPlanName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [stockNote, setStockNote] = useState("");

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!product) return;
        onSubmit({
          productId: product.id,
          productName: planDisplayName(planName, product.name),
          quantity,
          units: product.units,
          stockNote: stockNote || undefined,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Inventory item</label>
        <ProductPicker
          value={product}
          placeholder="Select a catalog item to deduct..."
          onChange={(p) => {
            setProduct(p);
            setPlanName(p ? planDisplayName(p.planName, p.name) : "");
          }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Plan name</label>
        <Input
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="How this appears in the SOAP plan"
        />
      </div>
      <StockUseFields
        product={product}
        quantity={quantity}
        onQuantityChange={setQuantity}
        note={stockNote}
        onNoteChange={setStockNote}
      />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading || !product}>
          {loading ? "Saving..." : "Record item use"}
        </Button>
      </div>
    </form>
  );
}

export function LabTestForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    testName: string;
    notes?: string;
    resultDate?: string;
  }) => void;
  loading: boolean;
}) {
  const [testName, setTestName] = useState("");
  const [notes, setNotes] = useState("");
  const [resultDate, setResultDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!testName.trim()) return;
        onSubmit({
          testName: testName.trim(),
          notes: notes.trim() || undefined,
          resultDate: resultDate || undefined,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Test name</label>
        <Input
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          placeholder="e.g. CBC, Chemistry, UA"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Date ordered</label>
        <Input
          type="date"
          value={resultDate}
          onChange={(e) => setResultDate(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Notes</label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Order lab test"}
        </Button>
      </div>
    </form>
  );
}

function PatientAlerts({ patientId }: { patientId: string }) {
  const { data: vaccinations } = trpc.records.listVaccinations.useQuery({
    patientId,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = (vaccinations ?? []).filter((v) => {
    if (!v.nextDueDate) return false;
    const due = new Date(v.nextDueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  });

  if (overdue.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Overdue vaccinations ({overdue.length})
        </p>
        <ul className="mt-1 list-inside list-disc text-amber-800 dark:text-amber-300">
          {overdue.map((v) => (
            <li key={v.id}>
              {v.vaccineName} — due{" "}
              {v.nextDueDate
                ? new Date(v.nextDueDate).toLocaleDateString()
                : "unknown"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { PatientAlerts };
