import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const clientUpdatedAtSchema = z.coerce.date().optional();

/**
 * Optional client timestamp for offline sync (Phase 2).
 * Rejects updates when the server row was modified after the client's view.
 */
export function assertNotStale(
  rowUpdatedAt: Date | null | undefined,
  clientUpdatedAt: Date | undefined
): void {
  if (!clientUpdatedAt || !rowUpdatedAt) return;
  if (rowUpdatedAt.getTime() > clientUpdatedAt.getTime()) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This record was changed on another device. Refresh and try again.",
    });
  }
}
