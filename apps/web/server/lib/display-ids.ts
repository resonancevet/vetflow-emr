import { eq, sql } from "drizzle-orm";
import { practiceClientSequences, clients, patients } from "@openpims/db";
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
