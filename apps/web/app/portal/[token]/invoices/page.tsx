"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const statusStyles: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-400",
};

function formatDate(d: string | Date | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: string | number | null): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export default function InvoicesPage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = trpc.portal.getInvoices.useQuery({ token });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">Unable to load invoices.</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/portal/${token}`}
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to portal
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Invoices</h1>

      {!data || data.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No invoices yet.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {data.map((inv) => {
              const balance = parseFloat(String(inv.total)) - parseFloat(String(inv.paidAmount));
              return (
                <div key={inv.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{formatCurrency(inv.total)}</p>
                      <p className="text-sm text-gray-500">{formatDate(inv.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        statusStyles[inv.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  {inv.patientName && (
                    <p className="text-sm text-gray-500">Patient: {inv.patientName}</p>
                  )}
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-400">
                      Paid: {formatCurrency(inv.paidAmount)}
                    </span>
                    {balance > 0 && (
                      <span className="font-medium text-red-600">
                        Balance: {formatCurrency(balance)}
                      </span>
                    )}
                  </div>
                  {inv.dueDate && (
                    <p className="text-xs text-gray-400 mt-1">Due: {formatDate(inv.dueDate)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Patient</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Paid</th>
                  <th className="pb-2 font-medium text-right">Balance</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((inv) => {
                  const balance =
                    parseFloat(String(inv.total)) - parseFloat(String(inv.paidAmount));
                  return (
                    <tr key={inv.id}>
                      <td className="py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 text-gray-900">{inv.patientName || "-"}</td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className={`py-3 text-right font-medium ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(balance)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            statusStyles[inv.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
