"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n.toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  past_due: "bg-amber-100 text-amber-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function PackagesPage() {
  const { data: sales, isLoading } = trpc.servicePackages.listSales.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/billing">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Billing
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Service packages</h1>
            <p className="text-sm text-muted-foreground">
              Sold packages and payment plans
            </p>
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/billing/packages/sell">
            <Plus className="mr-1 h-4 w-4" />
            Sell package
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Package</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Billing</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{sale.packageName}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.patientName ? `Patient: ${sale.patientName}` : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {[sale.clientFirstName, sale.clientLastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {sale.billingMode === "pay_in_full"
                      ? "Pay in full"
                      : "12-month plan"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(sale.contractTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[sale.status] ?? STATUS_STYLES.active
                      }`}
                    >
                      {sale.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/billing/packages/${sale.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {(!sales || sales.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No packages sold yet.{" "}
                    <Link
                      href="/billing/packages/sell"
                      className="underline text-foreground"
                    >
                      Sell a package
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
