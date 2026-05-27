import { z } from "zod";
import { eq, and, isNull, desc, or, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import { patientAlerts, patients } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import {
  assertNotStale,
  clientUpdatedAtSchema,
} from "../lib/optimistic-update";

const alertTypeSchema = z.enum(["behavior", "medical", "financial", "other"]);
const alertSeveritySchema = z.enum(["info", "warning", "critical"]);

async function assertPatientInPractice(
  db: Database,
  practiceId: string,
  patientId: string
) {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.practiceId, practiceId),
        isNull(patients.deletedAt)
      )
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
  }
}

export const patientAlertsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertPatientInPractice(ctx.db, ctx.practiceId, input.patientId);

      const now = new Date();
      const conditions = [
        eq(patientAlerts.practiceId, ctx.practiceId),
        eq(patientAlerts.patientId, input.patientId),
        isNull(patientAlerts.deletedAt),
      ];

      if (input.activeOnly) {
        conditions.push(
          or(
            isNull(patientAlerts.expiresAt),
            gt(patientAlerts.expiresAt, now)
          )!
        );
      }

      return ctx.db
        .select()
        .from(patientAlerts)
        .where(and(...conditions))
        .orderBy(desc(patientAlerts.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        type: alertTypeSchema,
        severity: alertSeveritySchema.default("info"),
        title: z.string().min(1).max(255),
        notes: z.string().optional(),
        expiresAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPatientInPractice(ctx.db, ctx.practiceId, input.patientId);

      const [alert] = await ctx.db
        .insert(patientAlerts)
        .values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
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
        .from(patientAlerts)
        .where(
          and(
            eq(patientAlerts.id, id),
            eq(patientAlerts.practiceId, ctx.practiceId),
            isNull(patientAlerts.deletedAt)
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
        .update(patientAlerts)
        .set(updatePayload)
        .where(eq(patientAlerts.id, id))
        .returning();
      return alert!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [alert] = await ctx.db
        .update(patientAlerts)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(patientAlerts.id, input.id),
            eq(patientAlerts.practiceId, ctx.practiceId),
            isNull(patientAlerts.deletedAt)
          )
        )
        .returning();
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      return { success: true };
    }),
});
