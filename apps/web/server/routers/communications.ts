import { z } from "zod";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import { communications, clients } from "@openpims/db";

export const communicationsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(communications.practiceId, ctx.practiceId),
      ];

      if (input.clientId) {
        conditions.push(eq(communications.clientId, input.clientId));
      }

      if (input.status) {
        conditions.push(
          eq(
            communications.status,
            input.status as "pending" | "sent" | "delivered" | "read" | "failed"
          )
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: communications.id,
            clientId: communications.clientId,
            channel: communications.channel,
            direction: communications.direction,
            subject: communications.subject,
            content: communications.content,
            status: communications.status,
            assignedTo: communications.assignedTo,
            createdAt: communications.createdAt,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
          })
          .from(communications)
          .leftJoin(clients, eq(communications.clientId, clients.id))
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
        .select({
          id: communications.id,
          channel: communications.channel,
          direction: communications.direction,
          subject: communications.subject,
          content: communications.content,
          status: communications.status,
          assignedTo: communications.assignedTo,
          createdAt: communications.createdAt,
        })
        .from(communications)
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            eq(communications.clientId, input.clientId)
          )
        )
        .orderBy(desc(communications.createdAt));
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
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
      const [comm] = await ctx.db
        .insert(communications)
        .values({
          ...input,
          practiceId: ctx.practiceId,
          assignedTo: ctx.user.id,
          status: input.status ?? "pending",
        })
        .returning();
      return comm!;
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
      if (!comm) throw new Error("Communication not found");
      return comm;
    }),
});
