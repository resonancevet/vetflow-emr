"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n.toFixed(2)}`;
}

export default function PackageSaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const utils = trpc.useUtils();
  const { data: sale, isLoading } = trpc.servicePackages.getSale.useQuery(
    { id },
    { enabled: !!id }
  );

  const cancelSale = trpc.servicePackages.cancelSale.useMutation({
    onSuccess: () => {
      toast.success("Package sale cancelled");
      utils.servicePackages.getSale.invalidate({ id });
      utils.servicePackages.listSales.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Sale not found.</p>
        <Button variant="outline" asChild>
          <Link href="/billing/packages">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/billing/packages">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Packages
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{sale.packageName}</h1>
            <p className="text-sm text-muted-foreground">
              {[sale.clientFirstName, sale.clientLastName]
                .filter(Boolean)
                .join(" ")}
              {sale.patientName ? ` · ${sale.patientName}` : ""}
            </p>
          </div>
        </div>
        {(sale.status === "active" || sale.status === "past_due") && (
          <Button
            size="sm"
            variant="outline"
            disabled={cancelSale.isPending}
            onClick={() => {
              if (
                confirm(
                  "Cancel this package? Future scheduled installments will be voided. Existing invoices stay."
                )
              ) {
                cancelSale.mutate({ id: sale.id });
              }
            }}
          >
            Cancel sale
          </Button>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Billing</p>
          <p className="font-medium">
            {sale.billingMode === "pay_in_full"
              ? "Pay in full"
              : "12-month plan"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Contract total</p>
          <p className="font-medium tabular-nums">
            {formatMoney(sale.contractTotal)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-medium capitalize">
            {sale.status.replace("_", " ")}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Due</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {sale.installments.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">{row.sequenceNumber}</td>
                <td className="px-4 py-3">{row.dueDate}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(row.amount)}
                </td>
                <td className="px-4 py-3 capitalize">
                  {row.status}
                  {row.invoiceStatus ? ` · inv ${row.invoiceStatus}` : ""}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.invoiceId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push("/billing")}
                    >
                      Open billing
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
