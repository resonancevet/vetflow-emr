import { z } from "zod";
import { eq, and, isNull, desc, or, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import { clientAlerts, clients } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  assertNotStale,
  clientUpdatedAtSchema,
} from "../lib/optimistic-update";

const alertTypeSchema = z.enum(["billing", "other"]);
const alertSeveritySchema = z.enum(["info", "warning", "critical"]);

async function assertClientInPractice(
  db: Database,
  practiceId: string,
  clientId: string
) {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.practiceId, practiceId),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
  }
}

export const clientAlertsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertClientInPractice(ctx.db, ctx.practiceId, input.clientId);

      const now = new Date();
      const conditions = [
        eq(clientAlerts.practiceId, ctx.practiceId),
        eq(clientAlerts.clientId, input.clientId),
        isNull(clientAlerts.deletedAt),
      ];

      if (input.activeOnly) {
        conditions.push(
          or(
            isNull(clientAlerts.expiresAt),
            gt(clientAlerts.expiresAt, now)
          )!
        );
      }

      return ctx.db
        .select()
        .from(clientAlerts)
        .where(and(...conditions))
        .orderBy(desc(clientAlerts.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        type: alertTypeSchema,
        severity: alertSeveritySchema.default("warning"),
        title: z.string().min(1).max(255),
        notes: z.string().optional(),
        expiresAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertClientInPractice(ctx.db, ctx.practiceId, input.clientId);

      const [alert] = await ctx.db
        .insert(clientAlerts)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          type: input.type,
          severity: input.severity,
          title: input.title,
          notes: input.notes,
          expiresAt: input.expiresAt,
          createdBy: ctx.user.id,
        })
        .returning();
      return alert!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: alertTypeSchema.optional(),
        severity: alertSeveritySchema.optional(),
        title: z.string().min(1).max(255).optional(),
        notes: z.string().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
        clientUpdatedAt: clientUpdatedAtSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientUpdatedAt, expiresAt, ...fields } = input;

      const [existing] = await ctx.db
        .select()
        .from(clientAlerts)
        .where(
          and(
            eq(clientAlerts.id, id),
            eq(clientAlerts.practiceId, ctx.practiceId),
            isNull(clientAlerts.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }

      assertNotStale(existing.updatedAt, clientUpdatedAt);

      const updatePayload: Record<string, unknown> = { ...fields };
      if (expiresAt !== undefined) {
        updatePayload.expiresAt = expiresAt;
      }

      const [alert] = await ctx.db
        .update(clientAlerts)
        .set(updatePayload)
        .where(eq(clientAlerts.id, id))
        .returning();
      return alert!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .update(clientAlerts)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(clientAlerts.id, input.id),
            eq(clientAlerts.practiceId, ctx.practiceId),
            isNull(clientAlerts.deletedAt)
          )
        )
        .returning();
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      return { success: true };
    }),

  /**
   * Lightweight check used to show an alert icon next to a client name on the
   * patient page. Returns count + highest severity.
   */
  summaryForClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const rows = await ctx.db
        .select({
          id: clientAlerts.id,
          severity: clientAlerts.severity,
          type: clientAlerts.type,
          title: clientAlerts.title,
        })
        .from(clientAlerts)
        .where(
          and(
            eq(clientAlerts.practiceId, ctx.practiceId),
            eq(clientAlerts.clientId, input.clientId),
            isNull(clientAlerts.deletedAt),
            or(
              isNull(clientAlerts.expiresAt),
              gt(clientAlerts.expiresAt, now)
            )!
          )
        );

      const severityRank: Record<string, number> = {
        critical: 3,
        warning: 2,
        info: 1,
      };
      let topSeverity: "critical" | "warning" | "info" | null = null;
      for (const r of rows) {
        const sev = r.severity as "critical" | "warning" | "info";
        if (!topSeverity || severityRank[sev] > severityRank[topSeverity]) {
          topSeverity = sev;
        }
      }

      return {
        count: rows.length,
        topSeverity,
        items: rows,
      };
    }),
});
