import { z } from "zod";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import {
  clients,
  patients,
  staffReminders,
} from "@openpims/db";
import type { Database } from "@openpims/db/client";

async function assertPatientInPractice(
  db: Database,
  practiceId: string,
  patientId: string
) {
  const [row] = await db
    .select({ id: patients.id, clientId: patients.clientId })
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
  return row;
}

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
  return row;
}

export const staffRemindersRouter = createRouter({
  listOpen: protectedProcedure
    .input(
      z
        .object({
          patientId: z.string().uuid().optional(),
          clientId: z.string().uuid().optional(),
          includeUpcoming: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(staffReminders.practiceId, ctx.practiceId),
        isNull(staffReminders.deletedAt),
        isNull(staffReminders.completedAt),
      ];

      if (input?.patientId) {
        await assertPatientInPractice(ctx.db, ctx.practiceId, input.patientId);
        conditions.push(eq(staffReminders.patientId, input.patientId));
      }
      if (input?.clientId) {
        await assertClientInPractice(ctx.db, ctx.practiceId, input.clientId);
        conditions.push(eq(staffReminders.clientId, input.clientId));
      }
      if (!input?.includeUpcoming) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        conditions.push(lte(staffReminders.dueAt, endOfToday));
      }

      return ctx.db
        .select({
          id: staffReminders.id,
          title: staffReminders.title,
          notes: staffReminders.notes,
          dueAt: staffReminders.dueAt,
          clientId: staffReminders.clientId,
          patientId: staffReminders.patientId,
          createdAt: staffReminders.createdAt,
          patientName: patients.name,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
        })
        .from(staffReminders)
        .leftJoin(patients, eq(staffReminders.patientId, patients.id))
        .leftJoin(clients, eq(staffReminders.clientId, clients.id))
        .where(and(...conditions))
        .orderBy(asc(staffReminders.dueAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(255),
        notes: z.string().trim().max(5000).optional(),
        dueAt: z.coerce.date(),
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let clientId = input.clientId ?? null;
      let patientId = input.patientId ?? null;

      if (patientId) {
        const patient = await assertPatientInPractice(
          ctx.db,
          ctx.practiceId,
          patientId
        );
        if (!clientId) clientId = patient.clientId;
      } else if (clientId) {
        await assertClientInPractice(ctx.db, ctx.practiceId, clientId);
      }

      if (Number.isNaN(input.dueAt.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid due date",
        });
      }

      const [row] = await ctx.db
        .insert(staffReminders)
        .values({
          practiceId: ctx.practiceId,
          title: input.title.trim(),
          notes: input.notes?.trim() || null,
          dueAt: input.dueAt,
          patientId,
          clientId,
          appointmentId: input.appointmentId ?? null,
          createdBy: ctx.user.id,
        })
        .returning();

      return row!;
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: staffReminders.id,
          completedAt: staffReminders.completedAt,
        })
        .from(staffReminders)
        .where(
          and(
            eq(staffReminders.id, input.id),
            eq(staffReminders.practiceId, ctx.practiceId),
            isNull(staffReminders.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }
      if (existing.completedAt) {
        return { id: existing.id, alreadyCompleted: true };
      }

      const [row] = await ctx.db
        .update(staffReminders)
        .set({
          completedAt: new Date(),
          completedBy: ctx.user.id,
        })
        .where(eq(staffReminders.id, existing.id))
        .returning({ id: staffReminders.id });

      return { id: row!.id, alreadyCompleted: false };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: staffReminders.id })
        .from(staffReminders)
        .where(
          and(
            eq(staffReminders.id, input.id),
            eq(staffReminders.practiceId, ctx.practiceId),
            isNull(staffReminders.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reminder not found",
        });
      }

      await ctx.db
        .update(staffReminders)
        .set({ deletedAt: new Date() })
        .where(eq(staffReminders.id, existing.id));

      return { id: existing.id };
    }),
});
