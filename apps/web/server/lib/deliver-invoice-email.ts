import { and, eq, isNull } from "drizzle-orm";
import {
  clients,
  communications,
  invoiceItems,
  invoices,
  patients,
  practices,
} from "@openpims/db";
import { sendInvoiceEmail } from "@/lib/email";
import { generateInvoicePdf } from "@/lib/pdf";
import { getEmailTemplatesFromSettings } from "@/lib/email-templates";
import {
  buildPortalUrl,
  generatePortalAccessToken,
} from "@/lib/portal-token";
import { formatVisitDate } from "@/lib/practice-datetime";
import { getVenmoHandle } from "@/lib/tax";
import { queueInvoiceSync } from "@/lib/quickbooks-sync";
import {
  ensureInvoiceNumber,
  formatInvoiceNumber,
} from "@/server/lib/display-ids";

function formatInvoiceDateDisplay(
  invoiceDate: string | null,
  sentAt: Date | null,
  createdAt: Date
): string {
  if (invoiceDate) return formatVisitDate(invoiceDate);
  if (sentAt) return new Date(sentAt).toLocaleDateString();
  return new Date(createdAt).toLocaleDateString();
}

/**
 * Email an invoice PDF to the client. Used by the manual send mutation and the
 * installment auto-email cron. Does not email drafts or void invoices.
 * Paid invoices stay `paid` (only `sentAt` is set). Finalized → `sent`.
 */
export async function deliverInvoiceEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: { practiceId: string; invoiceId: string }
): Promise<{ success: true; emailId: string | null } | { success: false; error: string }> {
  const [invoice] = await db
    .select({
      id: invoices.id,
      total: invoices.total,
      paidAmount: invoices.paidAmount,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      status: invoices.status,
      dueDate: invoices.dueDate,
      invoiceDate: invoices.invoiceDate,
      sentAt: invoices.sentAt,
      createdAt: invoices.createdAt,
      invoiceNumber: invoices.invoiceNumber,
      clientId: invoices.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientEmail: clients.email,
      clientAddress: clients.address,
      clientCity: clients.city,
      clientState: clients.state,
      clientZip: clients.zip,
      clientDisplayId: clients.displayId,
      clientAccessToken: clients.accessToken,
      patientName: patients.name,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .leftJoin(patients, eq(invoices.patientId, patients.id))
    .where(
      and(
        eq(invoices.id, opts.invoiceId),
        eq(invoices.practiceId, opts.practiceId),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1);

  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }
  if (invoice.status === "draft") {
    return {
      success: false,
      error: "Finalize the invoice before emailing it to the client",
    };
  }
  if (invoice.status === "void") {
    return { success: false, error: "Cannot email a voided invoice" };
  }
  if (!invoice.clientEmail) {
    return {
      success: false,
      error: "Client does not have an email address on file",
    };
  }

  const [practice] = await db
    .select({
      name: practices.name,
      phone: practices.phone,
      address: practices.address,
      timezone: practices.timezone,
      settings: practices.settings,
    })
    .from(practices)
    .where(eq(practices.id, opts.practiceId))
    .limit(1);

  const templates = getEmailTemplatesFromSettings(practice?.settings);
  const emailCtx = {
    practiceName: practice?.name ?? "Your Veterinary Practice",
    practicePhone: practice?.phone ?? undefined,
    practiceAddress: practice?.address ?? undefined,
    timezone: practice?.timezone ?? "America/New_York",
    venmoHandle: getVenmoHandle(practice?.settings),
    templates,
  };

  let portalUrl: string | undefined;
  if (invoice.clientAccessToken) {
    portalUrl = buildPortalUrl(invoice.clientAccessToken);
  } else if (invoice.clientId) {
    const token = generatePortalAccessToken();
    await db
      .update(clients)
      .set({ accessToken: token })
      .where(eq(clients.id, invoice.clientId));
    portalUrl = buildPortalUrl(token);
  }

  const invoiceNumber =
    invoice.invoiceNumber ??
    (await ensureInvoiceNumber(db, opts.practiceId, invoice.id));
  const invoiceNumberLabel = invoiceNumber
    ? formatInvoiceNumber(invoiceNumber)
    : undefined;

  const items = await db
    .select({
      description: invoiceItems.description,
      quantity: invoiceItems.quantity,
      unitPrice: invoiceItems.unitPrice,
      total: invoiceItems.total,
    })
    .from(invoiceItems)
    .where(
      and(
        eq(invoiceItems.invoiceId, invoice.id),
        isNull(invoiceItems.deletedAt)
      )
    );

  const total = Number(invoice.total ?? 0);
  const paid = Number(invoice.paidAmount ?? 0);
  const balance = Math.max(0, total - paid);
  const formatMoney = (n: number | string) => `$${Number(n).toFixed(2)}`;
  const isPaid = balance <= 0.009 || invoice.status === "paid";

  const pdf = await generateInvoicePdf({
    practiceName: emailCtx.practiceName,
    practicePhone: emailCtx.practicePhone,
    practiceAddress: emailCtx.practiceAddress,
    clientName: `${invoice.clientFirstName ?? ""} ${invoice.clientLastName ?? ""}`.trim(),
    clientEmail: invoice.clientEmail ?? undefined,
    clientAddress: invoice.clientAddress ?? undefined,
    clientCity: invoice.clientCity ?? undefined,
    clientState: invoice.clientState ?? undefined,
    clientZip: invoice.clientZip ?? undefined,
    clientDisplayId: invoice.clientDisplayId ?? undefined,
    patientName: invoice.patientName ?? undefined,
    invoiceNumber: invoiceNumberLabel,
    invoiceDate: formatInvoiceDateDisplay(
      invoice.invoiceDate,
      invoice.sentAt,
      invoice.createdAt
    ),
    dueDate: invoice.dueDate ? formatVisitDate(invoice.dueDate) : undefined,
    status: invoice.status,
    isPaid,
    items: items.map(
      (item: {
        description: string | null;
        quantity: number | null;
        unitPrice: string;
        total: string;
      }) => ({
        description: item.description ?? "",
        quantity: Number(item.quantity ?? 1),
        unitPrice: formatMoney(item.unitPrice),
        total: formatMoney(item.total),
      })
    ),
    subtotal: formatMoney(invoice.subtotal ?? 0),
    tax: formatMoney(invoice.tax ?? 0),
    total: formatMoney(total),
    paidAmount: formatMoney(paid),
    venmoHandle: emailCtx.venmoHandle || undefined,
  });
  const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

  const result = await sendInvoiceEmail(
    {
      to: invoice.clientEmail,
      clientName: `${invoice.clientFirstName} ${invoice.clientLastName}`,
      patientName: invoice.patientName ?? undefined,
      invoiceTotal: formatMoney(total),
      paidAmount: formatMoney(paid),
      balanceDue: formatMoney(balance),
      dueDate: isPaid
        ? "PAID"
        : invoice.dueDate
          ? formatVisitDate(invoice.dueDate)
          : undefined,
      status: invoice.status,
      venmoHandle: emailCtx.venmoHandle || undefined,
      practiceName: emailCtx.practiceName,
      practicePhone: emailCtx.practicePhone,
      portalUrl,
      invoiceNumber: invoiceNumberLabel,
      pdfAttachment: {
        filename: `invoice-${invoiceNumberLabel ?? invoice.id.slice(0, 8)}.pdf`,
        content: pdfBuffer,
      },
    },
    emailCtx.templates.invoiceEmail
  );

  if (!result.success) {
    return {
      success: false,
      error:
        result.error ??
        "Failed to send email. Check Resend domain/from address and server logs.",
    };
  }

  const now = new Date();
  const statusUpdate: Record<string, unknown> = {
    sentAt: now,
    updatedAt: now,
  };
  if (invoice.status === "finalized") {
    statusUpdate.status = "sent";
  }
  if (!invoice.invoiceDate) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    statusUpdate.invoiceDate = `${y}-${m}-${d}`;
  }

  await db
    .update(invoices)
    .set(statusUpdate)
    .where(
      and(
        eq(invoices.id, invoice.id),
        eq(invoices.practiceId, opts.practiceId)
      )
    );

  if (invoice.status === "finalized" || invoice.status === "paid") {
    queueInvoiceSync(db, opts.practiceId, invoice.id);
  }

  await db.insert(communications).values({
    practiceId: opts.practiceId,
    clientId: invoice.clientId,
    channel: "email",
    direction: "outbound",
    subject: "Invoice",
    content: `Invoice sent — total: $${Number(invoice.total ?? 0).toFixed(2)}${
      isPaid ? " (PAID)" : ""
    }`,
    status: "sent",
  });

  return { success: true, emailId: result.id ?? null };
}
