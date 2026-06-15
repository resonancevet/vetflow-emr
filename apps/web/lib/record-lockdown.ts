import { and, isNull, lte, eq } from "drizzle-orm";
import type { Database } from "@openpims/db/client";
import { soapNotes } from "@openpims/db";

/** NH Vet 701.01(c): lock computerized records after 24 hours. */
export const RECORD_LOCKDOWN_HOURS = 24;

export async function autoFinalizeStaleSoapNotes(db: Database) {
  const cutoff = new Date(Date.now() - RECORD_LOCKDOWN_HOURS * 60 * 60 * 1000);

  const stale = await db
    .select({
      id: soapNotes.id,
      practiceId: soapNotes.practiceId,
      authorId: soapNotes.authorId,
    })
    .from(soapNotes)
    .where(
      and(
        isNull(soapNotes.finalizedAt),
        isNull(soapNotes.deletedAt),
        lte(soapNotes.createdAt, cutoff)
      )
    );

  const now = new Date();
  let finalized = 0;

  for (const note of stale) {
    await db
      .update(soapNotes)
      .set({
        finalizedAt: now,
        finalizedBy: note.authorId,
        autoFinalized: true,
      })
      .where(eq(soapNotes.id, note.id));
    finalized++;
  }

  return { finalized, scanned: stale.length };
}
