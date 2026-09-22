import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { quickbooksConnections, invoices } from "@openpims/db";
import {
  getValidAccessToken,
  loadActiveConnection,
  qboListAccounts,
} from "@/lib/quickbooks-api";
import { quickbooksConfigured } from "@/lib/quickbooks-oauth";
import {
  syncInvoiceToQuickBooks,
  syncPaymentToQuickBooks,
} from "@/lib/quickbooks-sync";

export const quickbooksRouter = createRouter({
  status: protectedProcedure.query(async ({ ctx }) => {
    const connection = await loadActiveConnection(ctx.db, ctx.practiceId);
    return {
      configured: quickbooksConfigured(),
      connected: Boolean(connection),
      companyName: connection?.companyName ?? null,
      realmId: connection?.realmId ?? null,
      incomeAccountId: connection?.incomeAccountId ?? null,
      depositAccountId: connection?.depositAccountId ?? null,
      defaultItemId: connection?.defaultItemId ?? null,
      lastSyncAt: connection?.lastSyncAt ?? null,
      lastError: connection?.lastError ?? null,
    };
  }),

  listAccounts: protectedProcedure
    .use(requireRole("admin"))
    .query(async ({ ctx }) => {
      const connection = await loadActiveConnection(ctx.db, ctx.practiceId);
      if (!connection) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connect QuickBooks first",
        });
      }
      const { accessToken, connection: conn } = await getValidAccessToken(
        ctx.db,
        connection
      );
      return qboListAccounts(accessToken, conn.realmId);
    }),

  saveAccountMapping: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        incomeAccountId: z.string().min(1).max(64),
        depositAccountId: z.string().min(1).max(64).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(quickbooksConnections)
        .set({
          incomeAccountId: input.incomeAccountId,
          depositAccountId: input.depositAccountId ?? null,
          // Force item recreate against the new income account.
          defaultItemId: null,
          updatedAt: new Date(),
          lastError: null,
        })
        .where(
          and(
            eq(quickbooksConnections.practiceId, ctx.practiceId),
            isNull(quickbooksConnections.deletedAt)
          )
        )
        .returning({ id: quickbooksConnections.id });
      if (!updated) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Connect QuickBooks first",
        });
      }
      return { ok: true };
    }),

  disconnect: protectedProcedure
    .use(requireRole("admin"))
    .mutation(async ({ ctx }) => {
      await ctx.db
        .update(quickbooksConnections)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(quickbooksConnections.practiceId, ctx.practiceId),
            isNull(quickbooksConnections.deletedAt)
          )
        );
      return { ok: true };
    }),

  syncInvoice: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await syncInvoiceToQuickBooks(
        ctx.db,
        ctx.practiceId,
        input.invoiceId
      );
      if (!result) {
        const connection = await loadActiveConnection(ctx.db, ctx.practiceId);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            connection?.lastError ||
            "Invoice was not synced (not connected, draft/estimate, or already failed)",
        });
      }
      return result;
    }),

  syncRecentInvoices: protectedProcedure
    .use(requireRole("admin"))
    .mutation(async ({ ctx }) => {
      const recent = await ctx.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            eq(invoices.isEstimate, false),
            isNull(invoices.deletedAt)
          )
        )
        .orderBy(desc(invoices.createdAt))
        .limit(25);

      let synced = 0;
      for (const inv of recent) {
        const result = await syncInvoiceToQuickBooks(
          ctx.db,
          ctx.practiceId,
          inv.id
        );
        if (result) synced += 1;
      }
      return { attempted: recent.length, synced };
    }),
});
