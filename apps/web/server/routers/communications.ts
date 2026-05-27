import { z } from "zod";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure } from "../trpc";
import { communications, clients, patients, users } from "@openpims/db";
import {
  assertNotStale,
  clientUpdatedAtSchema,
} from "../lib/optimistic-update";

const commListSelect = {
  id: communications.id,
  clientId: communications.clientId,
  patientId: communications.patientId,
  channel: communications.channel,
  direction: communications.direction,
  subject: communications.subject,
  content: communications.content,
  status: communications.status,
  assignedTo: communications.assignedTo,
  createdAt: communications.createdAt,
  updatedAt: communications.updatedAt,
  clientFirstName: clients.firstName,
  clientLastName: clients.lastName,
  patientName: patients.name,
  assignedName: users.name,
};

export const communicationsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(communications.practiceId, ctx.practiceId)];

      if (input.clientId) {
        conditions.push(eq(communications.clientId, input.clientId));
      }

      if (input.patientId) {
        conditions.push(eq(communications.patientId, input.patientId));
      }

      if (input.status) {
        conditions.push(
          eq(
            communications.status,
            input.status as
              | "pending"
              | "sent"
              | "delivered"
              | "read"
              | "failed"
          )
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select(commListSelect)
          .from(communications)
          .leftJoin(clients, eq(communications.clientId, clients.id))
          .leftJoin(patients, eq(communications.patientId, patients.id))
          .leftJoin(users, eq(communications.assignedTo, users.id))
          .where(and(...conditions))
          .orderBy(desc(communications.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(communications)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  getByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select(commListSelect)
        .from(communications)
        .leftJoin(clients, eq(communications.clientId, clients.id))
        .leftJoin(patients, eq(communications.patientId, patients.id))
        .leftJoin(users, eq(communications.assignedTo, users.id))
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            eq(communications.clientId, input.clientId)
          )
        )
        .orderBy(desc(communications.createdAt));
    }),

  getByPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select(commListSelect)
        .from(communications)
        .leftJoin(clients, eq(communications.clientId, clients.id))
        .leftJoin(patients, eq(communications.patientId, patients.id))
        .leftJoin(users, eq(communications.assignedTo, users.id))
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            eq(communications.patientId, input.patientId)
          )
        )
        .orderBy(desc(communications.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        channel: z.enum(["phone", "sms", "email", "portal"]),
        direction: z.enum(["inbound", "outbound"]),
        subject: z.string().optional(),
        content: z.string().min(1),
        status: z
          .enum(["pending", "sent", "delivered", "read", "failed"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.patientId) {
        const [patient] = await ctx.db
          .select({ clientId: patients.clientId })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt)
            )
          )
          .limit(1);

        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient not found",
          });
        }

        if (patient.clientId !== input.clientId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Patient does not belong to this client",
          });
        }
      }

      const [comm] = await ctx.db
        .insert(communications)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          patientId: input.patientId,
          channel: input.channel,
          direction: input.direction,
          subject: input.subject,
          content: input.content,
          assignedTo: ctx.user.id,
          status: input.status ?? "read",
        })
        .returning();
      return comm!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        channel: z.enum(["phone", "sms", "email", "portal"]).optional(),
        direction: z.enum(["inbound", "outbound"]).optional(),
        subject: z.string().optional(),
        content: z.string().min(1).optional(),
        patientId: z.string().uuid().nullable().optional(),
        clientUpdatedAt: clientUpdatedAtSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientUpdatedAt, patientId, ...fields } = input;

      const [existing] = await ctx.db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.id, id),
            eq(communications.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communication not found",
        });
      }

      assertNotStale(existing.updatedAt, clientUpdatedAt);

      // If patientId is being set, verify it belongs to the comm's client.
      if (patientId) {
        const [patient] = await ctx.db
          .select({ clientId: patients.clientId })
          .from(patients)
          .where(
            and(
              eq(patients.id, patientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt)
            )
          )
          .limit(1);

        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient not found",
          });
        }
        if (existing.clientId && patient.clientId !== existing.clientId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Patient does not belong to this client",
          });
        }
      }

      const updateValues: Record<string, unknown> = { ...fields };
      if (patientId !== undefined) {
        updateValues.patientId = patientId;
      }

      const [comm] = await ctx.db
        .update(communications)
        .set(updateValues)
        .where(eq(communications.id, id))
        .returning();
      return comm!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [comm] = await ctx.db
        .delete(communications)
        .where(
          and(
            eq(communications.id, input.id),
            eq(communications.practiceId, ctx.practiceId)
          )
        )
        .returning();
      if (!comm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Communication not found",
        });
      }
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["pending", "sent", "delivered", "read", "failed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comm] = await ctx.db
        .update(communications)
        .set({ status: input.status })
        .where(
          and(
            eq(communications.id, input.id),
            eq(communications.practiceId, ctx.practiceId)
          )
        )
        .returning();
      if (!comm) throw new TRPCError({ code: "NOT_FOUND", message: "Communication not found" });
      return comm;
    }),
});
