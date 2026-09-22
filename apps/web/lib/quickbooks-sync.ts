import { and, eq, isNull } from "drizzle-orm";
import {
  clients,
  invoiceItems,
  invoices,
  payments,
  quickbooksConnections,
  quickbooksEntityLinks,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  getValidAccessToken,
  loadActiveConnection,
  qboCreateCustomer,
  qboCreateInvoice,
  qboCreatePayment,
  qboFindOrCreateServiceItem,
} from "./quickbooks-api";
import { toVisitDateInput } from "./practice-datetime";

async function getLink(
  db: Database,
  practiceId: string,
  entityType: "customer" | "invoice" | "payment",
  localId: string
): Promise<string | null> {
  const [row] = await db
    .select({ qboId: quickbooksEntityLinks.qboId })
    .from(quickbooksEntityLinks)
    .where(
      and(
        eq(quickbooksEntityLinks.practiceId, practiceId),
        eq(quickbooksEntityLinks.entityType, entityType),
        eq(quickbooksEntityLinks.localId, localId),
        isNull(quickbooksEntityLinks.deletedAt)
      )
    )
    .limit(1);
  return row?.qboId ?? null;
}

async function saveLink(
  db: Database,
  practiceId: string,
  entityType: "customer" | "invoice" | "payment",
  localId: string,
  qboId: string
) {
  const existing = await getLink(db, practiceId, entityType, localId);
  if (existing) return existing;
  await db.insert(quickbooksEntityLinks).values({
    practiceId,
    entityType,
    localId,
    qboId,
  });
  return qboId;
}

async function markSyncError(
  db: Database,
  practiceId: string,
  message: string
) {
  await db
    .update(quickbooksConnections)
    .set({ lastError: message.slice(0, 2000), updatedAt: new Date() })
    .where(
      and(
        eq(quickbooksConnections.practiceId, practiceId),
        isNull(quickbooksConnections.deletedAt)
      )
    );
}

async function markSyncOk(db: Database, practiceId: string) {
  await db
    .update(quickbooksConnections)
    .set({
      lastSyncAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quickbooksConnections.practiceId, practiceId),
        isNull(quickbooksConnections.deletedAt)
      )
    );
}

async function ensureCustomer(
  db: Database,
  practiceId: string,
  accessToken: string,
  realmId: string,
  clientId: string
): Promise<string> {
  const existing = await getLink(db, practiceId, "customer", clientId);
  if (existing) return existing;

  const [client] = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
      phone: clients.phone,
      displayId: clients.displayId,
    })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.practiceId, practiceId),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);

  if (!client) throw new Error("Client not found for QuickBooks sync");

  const displayName = [
    client.firstName,
    client.lastName,
    client.displayId ? `(${client.displayId})` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  let qboId: string;
  try {
    qboId = await qboCreateCustomer(accessToken, realmId, {
      displayName: displayName || `Client ${client.id.slice(0, 8)}`,
      email: client.email,
      phone: client.phone,
    });
  } catch (err) {
    // Name collision — retry with uuid suffix.
    qboId = await qboCreateCustomer(accessToken, realmId, {
      displayName: `${displayName || "Client"} ${client.id.slice(0, 8)}`,
      email: client.email,
      phone: client.phone,
    });
    void err;
  }

  return saveLink(db, practiceId, "customer", clientId, qboId);
}

async function ensureDefaultItem(
  db: Database,
  connection: typeof quickbooksConnections.$inferSelect,
  accessToken: string
): Promise<{ itemId: string; connection: typeof quickbooksConnections.$inferSelect }> {
  if (connection.defaultItemId) {
    return { itemId: connection.defaultItemId, connection };
  }
  if (!connection.incomeAccountId) {
    throw new Error(
      "Choose an income account in Settings → Practice → QuickBooks before syncing"
    );
  }
  const itemId = await qboFindOrCreateServiceItem(
    accessToken,
    connection.realmId,
    connection.incomeAccountId
  );
  const [updated] = await db
    .update(quickbooksConnections)
    .set({ defaultItemId: itemId, updatedAt: new Date() })
    .where(eq(quickbooksConnections.id, connection.id))
    .returning();
  return { itemId, connection: updated ?? connection };
}

/** Push a VetRoamer invoice to QBO (no-op if already linked or QBO not connected). */
export async function syncInvoiceToQuickBooks(
  db: Database,
  practiceId: string,
  invoiceId: string
): Promise<{ qboInvoiceId: string } | null> {
  const connection = await loadActiveConnection(db, practiceId);
  if (!connection) return null;

  const already = await getLink(db, practiceId, "invoice", invoiceId);
  if (already) return { qboInvoiceId: already };

  try {
    const { accessToken, connection: conn } = await getValidAccessToken(
      db,
      connection
    );
    const { itemId, connection: withItem } = await ensureDefaultItem(
      db,
      conn,
      accessToken
    );

    const [invoice] = await db
      .select({
        id: invoices.id,
        clientId: invoices.clientId,
        dueDate: invoices.dueDate,
        total: invoices.total,
        name: invoices.name,
        isEstimate: invoices.isEstimate,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.practiceId, practiceId),
          isNull(invoices.deletedAt)
        )
      )
      .limit(1);

    if (!invoice || invoice.isEstimate || !invoice.clientId) {
      return null;
    }
    if (invoice.status === "void" || invoice.status === "draft") {
      return null;
    }

    const items = await db
      .select({
        description: invoiceItems.description,
        total: invoiceItems.total,
      })
      .from(invoiceItems)
      .where(
        and(
          eq(invoiceItems.invoiceId, invoiceId),
          isNull(invoiceItems.deletedAt)
        )
      );

    const lines =
      items.length > 0
        ? items.map((item) => ({
            description: item.description,
            amount: Number(item.total),
          }))
        : [
            {
              description: invoice.name || "Invoice",
              amount: Number(invoice.total),
            },
          ];

    const customerId = await ensureCustomer(
      db,
      practiceId,
      accessToken,
      withItem.realmId,
      invoice.clientId
    );

    const dueDate = invoice.dueDate
      ? toVisitDateInput(invoice.dueDate)
      : undefined;

    const qboInvoiceId = await qboCreateInvoice(
      accessToken,
      withItem.realmId,
      {
        customerId,
        itemId,
        dueDate,
        docNumber: invoice.id.replace(/-/g, "").slice(0, 21),
        lines,
      }
    );

    await saveLink(db, practiceId, "invoice", invoiceId, qboInvoiceId);
    await markSyncOk(db, practiceId);
    return { qboInvoiceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invoice sync failed";
    await markSyncError(db, practiceId, message);
    console.error("[QuickBooks] invoice sync failed:", message);
    return null;
  }
}

/** Push a recorded payment to QBO (ensures invoice exists first). */
export async function syncPaymentToQuickBooks(
  db: Database,
  practiceId: string,
  paymentId: string
): Promise<{ qboPaymentId: string } | null> {
  const connection = await loadActiveConnection(db, practiceId);
  if (!connection) return null;

  const already = await getLink(db, practiceId, "payment", paymentId);
  if (already) return { qboPaymentId: already };

  try {
    const { accessToken, connection: conn } = await getValidAccessToken(
      db,
      connection
    );

    const [payment] = await db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        amount: payments.amount,
        receivedAt: payments.receivedAt,
      })
      .from(payments)
      .where(
        and(eq(payments.id, paymentId), isNull(payments.deletedAt))
      )
      .limit(1);

    if (!payment) return null;

    const invoiceSync = await syncInvoiceToQuickBooks(
      db,
      practiceId,
      payment.invoiceId
    );
    const qboInvoiceId =
      invoiceSync?.qboInvoiceId ??
      (await getLink(db, practiceId, "invoice", payment.invoiceId));
    if (!qboInvoiceId) {
      throw new Error("Could not sync invoice before payment");
    }

    const [invoice] = await db
      .select({ clientId: invoices.clientId })
      .from(invoices)
      .where(eq(invoices.id, payment.invoiceId))
      .limit(1);
    if (!invoice?.clientId) {
      throw new Error("Invoice has no client for payment sync");
    }

    const customerId = await ensureCustomer(
      db,
      practiceId,
      accessToken,
      conn.realmId,
      invoice.clientId
    );

    const qboPaymentId = await qboCreatePayment(accessToken, conn.realmId, {
      customerId,
      invoiceId: qboInvoiceId,
      amount: Number(payment.amount),
      depositAccountId: conn.depositAccountId,
      paymentDate: payment.receivedAt
        ? toVisitDateInput(payment.receivedAt)
        : undefined,
    });

    await saveLink(db, practiceId, "payment", paymentId, qboPaymentId);
    await markSyncOk(db, practiceId);
    return { qboPaymentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment sync failed";
    await markSyncError(db, practiceId, message);
    console.error("[QuickBooks] payment sync failed:", message);
    return null;
  }
}

/** Fire-and-forget wrapper so billing mutations are not blocked by QBO. */
export function queueInvoiceSync(
  db: Database,
  practiceId: string,
  invoiceId: string
) {
  void syncInvoiceToQuickBooks(db, practiceId, invoiceId);
}

export function queuePaymentSync(
  db: Database,
  practiceId: string,
  paymentId: string
) {
  void syncPaymentToQuickBooks(db, practiceId, paymentId);
}
