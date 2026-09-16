"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  splitInstallmentAmounts,
  todayDateStringLocal,
} from "@/lib/service-packages";

export default function SellPackagePage() {
  const router = useRouter();
  const { data: packages, isLoading: packagesLoading } =
    trpc.servicePackages.listPackages.useQuery();
  const billingSettings = trpc.settings.getBillingSettings.useQuery();

  const [packageId, setPackageId] = useState("");
  const [billingMode, setBillingMode] = useState<"pay_in_full" | "monthly">(
    "pay_in_full"
  );
  const [startDate, setStartDate] = useState(todayDateStringLocal());
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const [patientId, setPatientId] = useState("");

  const clientResults = trpc.clients.search.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.trim().length >= 2 && !selectedClient }
  );
  const patientsQuery = trpc.billing.patientsByClient.useQuery(
    { clientId: selectedClient?.id ?? "" },
    { enabled: !!selectedClient }
  );

  const selectedPackage = useMemo(
    () => (packages ?? []).find((p) => p.id === packageId && p.isActive),
    [packages, packageId]
  );

  const sell = trpc.servicePackages.sellPackage.useMutation({
    onSuccess: (result) => {
      toast.success("Package sold — first invoice created");
      router.push(`/billing?highlight=${result.firstInvoiceId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const monthlyAmount =
    selectedPackage && selectedPackage.allowMonthly
      ? splitInstallmentAmounts(parseFloat(selectedPackage.priceTotal), 12)[0]
      : null;

  const venmoHandle = billingSettings.data?.venmoHandle;

  function submit() {
    if (!selectedPackage || !selectedClient) {
      toast.error("Choose a package and client");
      return;
    }
    if (
      billingMode === "pay_in_full" &&
      !selectedPackage.allowPayInFull
    ) {
      toast.error("This package does not allow pay in full");
      return;
    }
    if (billingMode === "monthly" && !selectedPackage.allowMonthly) {
      toast.error("This package does not allow monthly payments");
      return;
    }
    sell.mutate({
      packageId: selectedPackage.id,
      clientId: selectedClient.id,
      patientId: patientId || undefined,
      billingMode,
      startDate,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/billing/packages">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Packages
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Sell service package</h1>
          <p className="text-sm text-muted-foreground">
            Creates the sale and the first invoice. Remaining monthly invoices
            are generated automatically on their due dates.
          </p>
        </div>
      </div>

      {packagesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Package</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                const pkg = (packages ?? []).find((p) => p.id === e.target.value);
                if (pkg) {
                  if (pkg.allowPayInFull) setBillingMode("pay_in_full");
                  else if (pkg.allowMonthly) setBillingMode("monthly");
                }
              }}
            >
              <option value="">Select a package...</option>
              {(packages ?? [])
                .filter((p) => p.isActive)
                .map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — ${parseFloat(pkg.priceTotal).toFixed(2)}
                  </option>
                ))}
            </select>
          </label>

          {selectedPackage && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {selectedPackage.description || "No description"}
              {selectedPackage.items.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {selectedPackage.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <span className="text-sm font-medium">Payment option</span>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={!selectedPackage?.allowPayInFull}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  billingMode === "pay_in_full"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                } disabled:opacity-40`}
                onClick={() => setBillingMode("pay_in_full")}
              >
                Pay in full
                {selectedPackage
                  ? ` — $${parseFloat(selectedPackage.priceTotal).toFixed(2)}`
                  : ""}
              </button>
              <button
                type="button"
                disabled={!selectedPackage?.allowMonthly}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  billingMode === "monthly"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                } disabled:opacity-40`}
                onClick={() => setBillingMode("monthly")}
              >
                12-month plan
                {monthlyAmount ? ` — $${monthlyAmount}/mo` : ""}
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Start date</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Client *</span>
            {selectedClient ? (
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
                <span>
                  {selectedClient.firstName} {selectedClient.lastName}
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => {
                    setSelectedClient(null);
                    setPatientId("");
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients..."
                />
                {clientResults.data && clientResults.data.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card shadow">
                    {clientResults.data.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedClient(c);
                          setClientSearch("");
                        }}
                      >
                        {c.firstName} {c.lastName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedClient && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Patient (optional)</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">No patient</option>
                {(patientsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.species ? ` (${p.species})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </label>

          {venmoHandle && (
            <p className="text-xs text-muted-foreground">
              Payment instructions will reference Venmo {venmoHandle}. Record
              payments under Billing when received.
            </p>
          )}

          <Button
            onClick={submit}
            disabled={
              sell.isPending || !selectedPackage || !selectedClient
            }
          >
            {sell.isPending ? "Selling..." : "Sell package"}
          </Button>
        </div>
      )}
    </div>
  );
}
