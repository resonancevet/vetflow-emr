"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Loader2,
  Plus,
  DollarSign,
  ArrowRightLeft,
  Download,
  Mail,
  Pencil,
  Copy,
  Trash2,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { generateInvoicePdf } from "@/lib/pdf";
import { formatVisitDate } from "@/lib/practice-datetime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/common/loading";

const STATUS_TABS = [
  { label: "All", value: undefined, isEstimate: false as const },
  { label: "Draft", value: "draft", isEstimate: false as const },
  { label: "Finalized", value: "finalized", isEstimate: false as const },
  { label: "Sent", value: "sent", isEstimate: false as const },
  { label: "Paid", value: "paid", isEstimate: false as const },
  { label: "Overdue", value: "overdue", isEstimate: false as const },
  { label: "Void", value: "void", isEstimate: false as const },
  { label: "Estimates", value: undefined, isEstimate: true as const },
] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  finalized: "bg-indigo-100 text-indigo-800",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-gray-100 text-gray-500",
  partial: "bg-amber-100 text-amber-700",
  estimate: "bg-purple-100 text-purple-700",
  template: "bg-indigo-100 text-indigo-700",
};

const PAYMENT_METHODS = [
  { label: "Cash", value: "cash" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Debit Card", value: "debit_card" },
  { label: "Check", value: "check" },
  { label: "Venmo", value: "venmo" },
  { label: "Online", value: "online" },
  { label: "Other", value: "other" },
] as const;

function formatCurrency(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return `$${num.toFixed(2)}`;
}

function getDisplayStatus(invoice: {
  status: string;
  paidAmount: string | null;
  total: string | null;
  isEstimate: boolean;
  isTemplate?: boolean;
}): { label: string; style: string } {
  if (invoice.isTemplate) {
    return { label: "template", style: STATUS_STYLES.template };
  }
  if (invoice.isEstimate) {
    return { label: "estimate", style: STATUS_STYLES.estimate };
  }
  const paid = Number(invoice.paidAmount ?? 0);
  const total = Number(invoice.total ?? 0);
  if (paid > 0 && paid < total && invoice.status !== "paid") {
    return { label: "partial", style: STATUS_STYLES.partial };
  }
  return {
    label: invoice.status,
    style: STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft,
  };
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openPaymentForId, setOpenPaymentForId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const tab = STATUS_TABS[activeTab];
  const statusFilter = tab.isEstimate ? undefined : tab.value;
  const isEstimateFilter = tab.isEstimate ? true : false;

  const { data, isLoading, error } = trpc.billing.listInvoices.useQuery({
    status: statusFilter,
    isEstimate: isEstimateFilter,
    limit,
    offset,
  });
  const billingSettings = trpc.settings.getBillingSettings.useQuery();

  const utils = trpc.useUtils();

  const updateStatus = trpc.billing.updateInvoiceStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status updated");
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteDraft = trpc.billing.deleteDraftInvoice.useMutation({
    onSuccess: () => {
      toast.success("Draft invoice deleted");
      utils.billing.listInvoices.invalidate();
      setExpandedId(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const convertEstimate = trpc.billing.convertEstimateToInvoice.useMutation({
    onSuccess: () => {
      toast.success("Estimate converted to invoice");
      utils.billing.listInvoices.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleFinalize = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    updateStatus.mutate({ id, status: "finalized" });
  };

  const handleVoid = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Void this invoice? It will remain in the list as voided and cannot be emailed."
      )
    ) {
      return;
    }
    updateStatus.mutate({ id, status: "void" });
  };

  const handleDeleteDraft = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (
      !window.confirm(
        "Delete this draft invoice? This cannot be undone."
      )
    ) {
      return;
    }
    deleteDraft.mutate({ id });
  };

  const handleRecordPayment = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedId(id);
    setOpenPaymentForId(id);
  };

  const handleConvertEstimate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    convertEstimate.mutate({ id });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Invoices and payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/billing/packages">Packages</Link>
          </Button>
          <Button asChild>
            <Link href="/billing/new">
              <Plus className="mr-1 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mt-6 flex items-center gap-1 border-b border-border">
        {STATUS_TABS.map((t, idx) => (
          <button
            key={t.label}
            onClick={() => {
              setActiveTab(idx);
              setOffset(0);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === idx
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    isExpanded={expandedId === invoice.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === invoice.id ? null : invoice.id
                      )
                    }
                    onFinalize={handleFinalize}
                    onVoid={handleVoid}
                    onDeleteDraft={handleDeleteDraft}
                    onRecordPayment={handleRecordPayment}
                    openPaymentForm={openPaymentForId === invoice.id}
                    onPaymentFormOpened={() => {
                      if (openPaymentForId === invoice.id) {
                        setOpenPaymentForId(null);
                      }
                    }}
                    onConvertEstimate={handleConvertEstimate}
                    isMutating={
                      updateStatus.isPending ||
                      convertEstimate.isPending ||
                      deleteDraft.isPending
                    }
                    practiceName={
                      billingSettings.data?.practiceName || "Your Practice"
                    }
                    practicePhone={billingSettings.data?.practicePhone}
                    practiceAddress={billingSettings.data?.practiceAddress}
                    venmoHandle={billingSettings.data?.venmoHandle}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {offset + 1}--{Math.min(offset + limit, data.total)} of{" "}
              {data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= data.total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            {tab.isEstimate
              ? "No estimates yet"
              : statusFilter
              ? "No invoices with this status"
              : "No invoices yet"}
          </p>
        </div>
      )}
    </div>
  );
}

function InvoiceRow({
  invoice,
  isExpanded,
  onToggle,
  onFinalize,
  onVoid,
  onDeleteDraft,
  onRecordPayment,
  openPaymentForm,
  onPaymentFormOpened,
  onConvertEstimate,
  isMutating,
  practiceName,
  practicePhone,
  practiceAddress,
  venmoHandle,
}: {
  invoice: {
    id: string;
    status: string;
    subtotal: string | null;
    tax: string | null;
    total: string | null;
    paidAmount: string | null;
    dueDate: string | null;
    createdAt: Date | string | null;
    isEstimate: boolean;
    isTemplate?: boolean;
    name?: string | null;
    invoiceNumber?: number | null;
    clientFirstName: string | null;
    clientLastName: string | null;
    patientName: string | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  onFinalize: (e: React.MouseEvent, id: string) => void;
  onVoid: (e: React.MouseEvent, id: string) => void;
  onDeleteDraft: (e: React.MouseEvent, id: string) => void;
  onRecordPayment: (e: React.MouseEvent, id: string) => void;
  openPaymentForm: boolean;
  onPaymentFormOpened: () => void;
  onConvertEstimate: (e: React.MouseEvent, id: string) => void;
  isMutating: boolean;
  practiceName: string;
  practicePhone?: string;
  practiceAddress?: string;
  venmoHandle?: string;
}) {
  const detail = trpc.billing.getInvoice.useQuery(
    { id: invoice.id },
    { enabled: isExpanded }
  );

  const displayStatus = getDisplayStatus(invoice);

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
      >
        <td className="px-2 py-3 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium">
          {invoice.invoiceNumber != null && !invoice.isEstimate ? (
            <span className="mr-2 font-mono text-xs text-muted-foreground">
              #{String(invoice.invoiceNumber).padStart(4, "0")}
            </span>
          ) : null}
          {invoice.clientFirstName
            ? `${invoice.clientFirstName} ${invoice.clientLastName}`
            : invoice.name || "Untitled template"}
          {invoice.isTemplate && invoice.clientFirstName ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {invoice.name}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.patientName || "\u2014"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${displayStatus.style}`}
          >
            {displayStatus.label}
          </span>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatCurrency(invoice.total)}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">
          {formatCurrency(invoice.paidAmount)}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.dueDate ? formatVisitDate(invoice.dueDate) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {invoice.createdAt
            ? new Date(invoice.createdAt).toLocaleDateString()
            : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {invoice.isEstimate && (
              <>
                <Button variant="ghost" size="sm" asChild title="Edit estimate">
                  <Link
                    href={`/billing/new?id=${invoice.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                {invoice.isTemplate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    title="Use template"
                  >
                    <Link
                      href={`/billing/new?fromTemplate=${invoice.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={(e) => onConvertEstimate(e, invoice.id)}
                    title="Convert to Invoice"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            {!invoice.isEstimate && invoice.status === "draft" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMutating}
                  onClick={(e) => onFinalize(e, invoice.id)}
                  title="Finalize invoice"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMutating}
                  onClick={(e) => onDeleteDraft(e, invoice.id)}
                  title="Delete draft"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            )}
            {!invoice.isEstimate &&
              (invoice.status === "finalized" ||
                invoice.status === "sent" ||
                invoice.status === "overdue") && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => onRecordPayment(e, invoice.id)}
                    title="Record payment"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={(e) => onVoid(e, invoice.id)}
                    title="Void invoice"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            {!invoice.isEstimate && invoice.status === "paid" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isMutating}
                onClick={(e) => onVoid(e, invoice.id)}
                title="Void invoice"
              >
                <Ban className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={9} className="bg-muted/20 px-8 py-4">
            {detail.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading invoice details...
              </div>
            ) : detail.data ? (
              <div className="space-y-4">
                {/* Estimate Approval Card */}
                {invoice.isEstimate && (
                  <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        {invoice.isTemplate
                          ? "This is an estimate template"
                          : "This is an estimate"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/billing/new?id=${invoice.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </Button>
                      {invoice.isTemplate && (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/billing/new?fromTemplate=${invoice.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Use template
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const d = detail.data!;
                          const clientName =
                            [d.clientFirstName, d.clientLastName]
                              .filter(Boolean)
                              .join(" ") ||
                            d.name ||
                            invoice.name ||
                            "Estimate";
                          const doc = await generateInvoicePdf({
                            practiceName,
                            practicePhone: practicePhone || undefined,
                            practiceAddress: practiceAddress || undefined,
                            clientName,
                            clientEmail: d.clientEmail ?? undefined,
                            clientAddress: d.clientAddress ?? undefined,
                            clientDisplayId: d.clientDisplayId ?? undefined,
                            patientName: d.patientName ?? undefined,
                            invoiceNumber: d.invoiceNumber ?? undefined,
                            invoiceDate: d.createdAt
                              ? new Date(d.createdAt).toLocaleDateString()
                              : new Date().toLocaleDateString(),
                            dueDate: d.dueDate
                              ? formatVisitDate(d.dueDate)
                              : undefined,
                            status: "estimate",
                            items: d.items.map((item) => ({
                              description: item.description ?? "",
                              quantity: Number(item.quantity ?? 1),
                              unitPrice: formatCurrency(item.unitPrice),
                              total: formatCurrency(item.total),
                            })),
                            subtotal: formatCurrency(d.subtotal),
                            tax: formatCurrency(d.tax),
                            total: formatCurrency(d.total),
                            paidAmount: formatCurrency(d.paidAmount),
                            venmoHandle: venmoHandle || undefined,
                          });
                          doc.save(`estimate-${clientName || "unknown"}.pdf`);
                        }}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Present to Client
                      </Button>
                      {!invoice.isTemplate && (
                        <Button
                          size="sm"
                          disabled={isMutating}
                          onClick={(e) => onConvertEstimate(e, invoice.id)}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                          Approve &amp; Convert
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">
                    Client:{" "}
                    <span className="text-foreground font-medium">
                      {detail.data.clientFirstName}{" "}
                      {detail.data.clientLastName}
                    </span>
                  </span>
                  {detail.data.clientEmail && (
                    <span className="text-muted-foreground">
                      {detail.data.clientEmail}
                    </span>
                  )}
                </div>
                {detail.data.items.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">
                          Description
                        </th>
                        <th className="py-2 text-right font-medium text-muted-foreground">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2">{item.description}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td className="py-2 text-right font-medium">
                          Subtotal
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(detail.data.subtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 text-right text-muted-foreground">
                          Tax
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(detail.data.tax)}
                        </td>
                      </tr>
                      <tr className="font-semibold">
                        <td className="py-2 text-right">
                          Total
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCurrency(detail.data.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No line items on this invoice.
                  </p>
                )}

                {/* Balance Summary */}
                {!invoice.isEstimate && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                    <div className="flex items-center gap-6">
                      <span>
                        Total: <span className="font-semibold">{formatCurrency(detail.data.total)}</span>
                      </span>
                      <span>
                        Paid: <span className="font-semibold text-green-600">{formatCurrency(detail.data.paidAmount)}</span>
                      </span>
                      <span>
                        Balance:{" "}
                        <span className="font-semibold text-red-600">
                          {formatCurrency(
                            Number(detail.data.total ?? 0) -
                              Number(detail.data.paidAmount ?? 0)
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const d = detail.data!;
                          const clientName = [d.clientFirstName, d.clientLastName]
                            .filter(Boolean)
                            .join(" ");
                          const doc = await generateInvoicePdf({
                            practiceName,
                            practicePhone: practicePhone || undefined,
                            practiceAddress: practiceAddress || undefined,
                            clientName,
                            clientEmail: d.clientEmail ?? undefined,
                            clientAddress: d.clientAddress ?? undefined,
                            clientDisplayId: d.clientDisplayId ?? undefined,
                            patientName: d.patientName ?? undefined,
                            invoiceNumber: d.invoiceNumber ?? undefined,
                            invoiceDate: d.createdAt
                              ? new Date(d.createdAt).toLocaleDateString()
                              : new Date().toLocaleDateString(),
                            dueDate: d.dueDate
                              ? formatVisitDate(d.dueDate)
                              : undefined,
                            status: d.status,
                            isPaid:
                              d.status === "paid" ||
                              Number(d.total ?? 0) - Number(d.paidAmount ?? 0) <=
                                0.009,
                            items: d.items.map((item) => ({
                              description: item.description ?? "",
                              quantity: Number(item.quantity ?? 1),
                              unitPrice: formatCurrency(item.unitPrice),
                              total: formatCurrency(item.total),
                            })),
                            subtotal: formatCurrency(d.subtotal),
                            tax: formatCurrency(d.tax),
                            total: formatCurrency(d.total),
                            paidAmount: formatCurrency(d.paidAmount),
                            venmoHandle: venmoHandle || undefined,
                          });
                          doc.save(
                            `invoice-${d.invoiceNumber ?? (clientName || "unknown")}.pdf`
                          );
                        }}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download PDF
                      </Button>
                      {detail.data.status === "draft" ? (
                        <p className="text-xs text-muted-foreground self-center">
                          Finalize before emailing to client
                        </p>
                      ) : detail.data.status === "void" ? (
                        <p className="text-xs text-muted-foreground self-center">
                          Voided invoices cannot be emailed
                        </p>
                      ) : (
                        <EmailInvoiceButton
                          invoiceId={invoice.id}
                          preview={{
                            clientName: [
                              detail.data.clientFirstName,
                              detail.data.clientLastName,
                            ]
                              .filter(Boolean)
                              .join(" "),
                            clientEmail: detail.data.clientEmail,
                            patientName: detail.data.patientName,
                            total: formatCurrency(detail.data.total),
                            paid: formatCurrency(detail.data.paidAmount),
                            balance: formatCurrency(
                              Number(detail.data.total ?? 0) -
                                Number(detail.data.paidAmount ?? 0)
                            ),
                            dueDate: detail.data.dueDate
                              ? formatVisitDate(detail.data.dueDate)
                              : null,
                            status: detail.data.status,
                            venmoHandle: venmoHandle || null,
                            onPreviewPdf: async () => {
                              const d = detail.data!;
                              const clientName = [
                                d.clientFirstName,
                                d.clientLastName,
                              ]
                                .filter(Boolean)
                                .join(" ");
                              const doc = await generateInvoicePdf({
                                practiceName,
                                practicePhone: practicePhone || undefined,
                                practiceAddress: practiceAddress || undefined,
                                clientName,
                                clientEmail: d.clientEmail ?? undefined,
                                clientAddress: d.clientAddress ?? undefined,
                                clientDisplayId: d.clientDisplayId ?? undefined,
                                patientName: d.patientName ?? undefined,
                                invoiceNumber: d.invoiceNumber ?? undefined,
                                invoiceDate: d.createdAt
                                  ? new Date(d.createdAt).toLocaleDateString()
                                  : new Date().toLocaleDateString(),
                                dueDate: d.dueDate
                                  ? formatVisitDate(d.dueDate)
                                  : undefined,
                                status: d.status,
                                isPaid:
                                  d.status === "paid" ||
                                  Number(d.total ?? 0) -
                                    Number(d.paidAmount ?? 0) <=
                                    0.009,
                                items: d.items.map((item) => ({
                                  description: item.description ?? "",
                                  quantity: Number(item.quantity ?? 1),
                                  unitPrice: formatCurrency(item.unitPrice),
                                  total: formatCurrency(item.total),
                                })),
                                subtotal: formatCurrency(d.subtotal),
                                tax: formatCurrency(d.tax),
                                total: formatCurrency(d.total),
                                paidAmount: formatCurrency(d.paidAmount),
                                venmoHandle: venmoHandle || undefined,
                              });
                              window.open(doc.output("bloburl"), "_blank");
                            },
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Payment History & Record Payment */}
                {!invoice.isEstimate && (
                  <PaymentSection
                    invoiceId={invoice.id}
                    invoiceTotal={detail.data.total}
                    invoicePaidAmount={detail.data.paidAmount}
                    invoiceStatus={invoice.status}
                    autoOpen={openPaymentForm}
                    onAutoOpened={onPaymentFormOpened}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Failed to load invoice details.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function EmailInvoiceButton({
  invoiceId,
  preview,
}: {
  invoiceId: string;
  preview: {
    clientName: string;
    clientEmail: string | null;
    patientName: string | null;
    total: string;
    paid: string;
    balance: string;
    dueDate: string | null;
    status: string;
    venmoHandle: string | null;
    onPreviewPdf: () => void | Promise<void>;
  };
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sendInvoiceEmail = trpc.notifications.sendInvoiceEmail.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.emailId
          ? `Invoice emailed (Resend id: ${data.emailId})`
          : "Invoice emailed"
      );
      setConfirmOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setConfirmOpen(true);
        }}
      >
        <Mail className="mr-1 h-3.5 w-3.5" />
        Email Invoice
      </Button>
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            e.stopPropagation();
            if (!sendInvoiceEmail.isPending) setConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold">Preview before sending</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm what the client will see, then send.
              </p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">To</dt>
                <dd className="text-right font-medium">
                  {preview.clientEmail || "No email on file"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Client</dt>
                <dd className="text-right">{preview.clientName || "—"}</dd>
              </div>
              {preview.patientName && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Patient</dt>
                  <dd className="text-right">{preview.patientName}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-right capitalize">{preview.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-right tabular-nums">{preview.total}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-right tabular-nums text-green-600">
                  {preview.paid}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-2">
                <dt className="font-medium">Balance due</dt>
                <dd className="text-right tabular-nums font-semibold">
                  {preview.balance}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Due date</dt>
                <dd className="text-right">{preview.dueDate || "—"}</dd>
              </div>
              {preview.venmoHandle && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Venmo</dt>
                  <dd className="text-right">{preview.venmoHandle}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void preview.onPreviewPdf();
                }}
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Open PDF preview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={sendInvoiceEmail.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  sendInvoiceEmail.isPending || !preview.clientEmail
                }
                onClick={(e) => {
                  e.stopPropagation();
                  sendInvoiceEmail.mutate({ invoiceId });
                }}
              >
                {sendInvoiceEmail.isPending ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="mr-1 h-3.5 w-3.5" />
                )}
                Send email
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PaymentSection({
  invoiceId,
  invoiceTotal,
  invoicePaidAmount,
  invoiceStatus,
  autoOpen,
  onAutoOpened,
}: {
  invoiceId: string;
  invoiceTotal: string | null;
  invoicePaidAmount: string | null;
  invoiceStatus: string;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  const utils = trpc.useUtils();

  const paymentsQuery = trpc.billing.listPayments.useQuery({ invoiceId });

  const recordPayment = trpc.billing.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      utils.billing.listPayments.invalidate({ invoiceId });
      utils.billing.listInvoices.invalidate();
      utils.billing.getInvoice.invalidate({ id: invoiceId });
      setShowPaymentForm(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentNotes("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const remaining = Math.max(
    0,
    Number(invoiceTotal ?? 0) - Number(invoicePaidAmount ?? 0)
  );
  const hasPayments = (paymentsQuery.data?.length ?? 0) > 0;
  /** Allow documenting method when status was marked paid without a payment row. */
  const canRecord =
    invoiceStatus !== "draft" &&
    invoiceStatus !== "void" &&
    (remaining > 0 ||
      (!hasPayments &&
        !paymentsQuery.isLoading &&
        invoiceStatus === "paid" &&
        Number(invoicePaidAmount ?? 0) > 0));

  const handleOpenForm = () => {
    setPaymentAmount(
      (remaining > 0
        ? remaining
        : Number(invoicePaidAmount ?? invoiceTotal ?? 0)
      ).toFixed(2)
    );
    setShowPaymentForm(true);
  };

  useEffect(() => {
    if (!autoOpen || showPaymentForm || !canRecord) return;
    handleOpenForm();
    onAutoOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when Actions triggers expand
  }, [autoOpen, canRecord, showPaymentForm]);

  const handleRecordPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;
    recordPayment.mutate({
      invoiceId,
      amount: paymentAmount,
      method: paymentMethod as
        | "cash"
        | "credit_card"
        | "debit_card"
        | "check"
        | "venmo"
        | "online"
        | "other",
      notes: paymentNotes || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Payment History</h4>
        {canRecord && !showPaymentForm && (
          <Button variant="outline" size="sm" onClick={handleOpenForm}>
            <DollarSign className="mr-1 h-3.5 w-3.5" />
            Record Payment
          </Button>
        )}
      </div>

      {showPaymentForm && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter the amount received and how it was paid. This updates the
            invoice balance and status.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Method
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Notes (optional)
              </label>
              <Input
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Reference, check #, etc."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleRecordPayment}
              disabled={
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                recordPayment.isPending
              }
            >
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPaymentForm(false)}
            >
              Cancel
            </Button>
          </div>
          {recordPayment.isError && (
            <p className="text-xs text-destructive">
              {recordPayment.error.message}
            </p>
          )}
        </div>
      )}

      {paymentsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading payments...</p>
      ) : paymentsQuery.data && paymentsQuery.data.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium text-muted-foreground">
                Date
              </th>
              <th className="py-2 text-right font-medium text-muted-foreground">
                Amount
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                Method
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                Received By
              </th>
              <th className="py-2 text-left font-medium text-muted-foreground">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {paymentsQuery.data.map((payment) => (
              <tr
                key={payment.id}
                className="border-b border-border/50 last:border-0"
              >
                <td className="py-2 text-muted-foreground">
                  {payment.receivedAt
                    ? new Date(payment.receivedAt).toLocaleDateString()
                    : "\u2014"}
                </td>
                <td className="py-2 text-right tabular-nums font-medium text-green-600">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="py-2 capitalize text-muted-foreground">
                  {payment.method?.replace(/_/g, " ") ?? "\u2014"}
                </td>
                <td className="py-2 text-muted-foreground">
                  {payment.receivedByName ?? "\u2014"}
                </td>
                <td className="py-2 text-muted-foreground">
                  {payment.notes || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">
          No payments recorded yet.
          {invoiceStatus === "paid"
            ? " Use Record Payment to document how this was paid."
            : ""}
        </p>
      )}
    </div>
  );
}
