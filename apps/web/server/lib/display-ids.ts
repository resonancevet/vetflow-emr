import { eq, sql } from "drizzle-orm";
import {
  practiceClientSequences,
  practiceInvoiceSequences,
  clients,
  patients,
  invoices,
} from "@openpims/db";
import {
  formatClientDisplayId,
  formatPatientDisplayId,
  parseClientSeqFromDisplayId,
} from "@/lib/display-ids";

/** Allocate the next client display ID for a practice (C0001, C0002, …). */
export async function allocateClientDisplayId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
): Promise<string> {
  const [row] = await db
    .insert(practiceClientSequences)
    .values({ practiceId, nextSeq: 2 })
    .onConflictDoUpdate({
      target: practiceClientSequences.practiceId,
      set: { nextSeq: sql`${practiceClientSequences.nextSeq} + 1` },
    })
    .returning({ nextSeq: practiceClientSequences.nextSeq });

  const allocated = (row?.nextSeq ?? 2) - 1;
  return formatClientDisplayId(allocated);
}

/** Allocate the next patient display ID under a client (P0042-01, …). */
export async function allocatePatientDisplayId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  clientId: string,
): Promise<string> {
  const [client] = await db
    .select({ displayId: clients.displayId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  let clientSeq = parseClientSeqFromDisplayId(client?.displayId);
  if (!clientSeq) {
    // Legacy client without display ID — assign one now
    const displayId = await allocateClientDisplayId(db, practiceId);
    await db
      .update(clients)
      .set({ displayId })
      .where(eq(clients.id, clientId));
    clientSeq = parseClientSeqFromDisplayId(displayId)!;
  }

  const [agg] = await db
    .select({
      maxPet: sql<number>`coalesce(max(
        nullif(substring(${patients.displayId} from '-(\\d+)$'), '')::int
      ), 0)`,
    })
    .from(patients)
    .where(eq(patients.clientId, clientId));

  const nextPet = Number(agg?.maxPet ?? 0) + 1;
  return formatPatientDisplayId(clientSeq, nextPet);
}

/** Allocate the next sequential invoice number for a practice (1, 2, 3, …). */
export async function allocateInvoiceNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
): Promise<number> {
  const [row] = await db
    .insert(practiceInvoiceSequences)
    .values({ practiceId, nextSeq: 2 })
    .onConflictDoUpdate({
      target: practiceInvoiceSequences.practiceId,
      set: { nextSeq: sql`${practiceInvoiceSequences.nextSeq} + 1` },
    })
    .returning({ nextSeq: practiceInvoiceSequences.nextSeq });

  return (row?.nextSeq ?? 2) - 1;
}

/**
 * Ensure an invoice has a sequential number. No-ops for estimates/templates.
 * Returns the assigned (or existing) number, or null if not applicable.
 */
export async function ensureInvoiceNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  invoiceId: string,
): Promise<number | null> {
  const [row] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      isEstimate: invoices.isEstimate,
      isTemplate: invoices.isTemplate,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!row || row.isEstimate || row.isTemplate) return null;
  if (row.invoiceNumber != null) return row.invoiceNumber;

  const invoiceNumber = await allocateInvoiceNumber(db, practiceId);
  await db
    .update(invoices)
    .set({ invoiceNumber, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
  return invoiceNumber;
}

/** Display form for invoice numbers (matches Roma template #### style). */
export function formatInvoiceNumber(n: number): string {
  return String(n).padStart(4, "0");
}
