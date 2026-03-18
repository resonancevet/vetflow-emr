import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { webhooks } from "@openpims/db";

const WEBHOOK_EVENTS = [
  "appointment.created",
  "appointment.updated",
  "appointment.status_changed",
  "patient.created",
  "patient.updated",
  "client.created",
  "invoice.created",
  "invoice.paid",
  "prescription.created",
  "vaccination.recorded",
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const adminProcedure = protectedProcedure.use(requireRole("admin"));

export const webhooksRouter = createRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        active: webhooks.active,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(
        and(
          eq(webhooks.practiceId, ctx.practiceId),
          isNull(webhooks.deletedAt)
        )
      );
  }),

  create: adminProcedure
    .input(
      z.object({
        url: z.string().url(),
        events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const secret = randomUUID();

      const [webhook] = await ctx.db
        .insert(webhooks)
        .values({
          practiceId: ctx.practiceId,
          url: input.url,
          events: input.events,
          secret,
          active: true,
        })
        .returning();

      return {
        ...webhook!,
        secret, // Shown once at creation time
      };
    }),

  toggle: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get current state
      const [existing] = await ctx.db
        .select({ active: webhooks.active })
        .from(webhooks)
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.practiceId, ctx.practiceId),
            isNull(webhooks.deletedAt)
          )
        );

      if (!existing) {
        throw new Error("Webhook not found");
      }

      const [updated] = await ctx.db
        .update(webhooks)
        .set({ active: !existing.active })
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.practiceId, ctx.practiceId)
          )
        )
        .returning();

      return updated!;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .update(webhooks)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(webhooks.id, input.id),
            eq(webhooks.practiceId, ctx.practiceId),
            isNull(webhooks.deletedAt)
          )
        )
        .returning();

      if (!deleted) {
        throw new Error("Webhook not found");
      }

      return { success: true as const };
    }),

  events: adminProcedure.query(() => {
    return WEBHOOK_EVENTS.map((event) => ({ event }));
  }),
});
