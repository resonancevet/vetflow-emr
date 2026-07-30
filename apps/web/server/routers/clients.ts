import { z } from "zod";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { clients, patients, practices } from "@openpims/db";
import {
  buildPortalUrl,
  generatePortalAccessToken,
} from "@/lib/portal-token";
import { sendPortalInviteEmail } from "@/lib/email";

async function getClientForPractice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  clientId: string
) {
  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.practiceId, practiceId),
        isNull(clients.deletedAt)
      )
    )
    .limit(1);
  if (!client) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
  }
  return client;
}

export const clientsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(clients.practiceId, ctx.practiceId),
        isNull(clients.deletedAt),
      ];

      if (input.search) {
        conditions.push(
          or(
            ilike(clients.firstName, `%${input.search}%`),
            ilike(clients.lastName, `%${input.search}%`),
            ilike(clients.email, `%${input.search}%`),
            ilike(clients.phone, `%${input.search}%`)
          )!
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(clients)
          .where(and(...conditions))
          .orderBy(desc(clients.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(clients)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
        })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt),
            or(
              ilike(clients.firstName, `%${input.query}%`),
              ilike(clients.lastName, `%${input.query}%`),
              ilike(clients.email, `%${input.query}%`)
            )
          )
        )
        .limit(10);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, input.id),
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);

      if (!client) throw new Error("Client not found");

      const clientPatients = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.clientId, input.id),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        );

      return {
        ...client,
        patients: clientPatients,
        portalUrl: client.accessToken
          ? buildPortalUrl(client.accessToken)
          : null,
        portalEnabled: Boolean(client.accessToken),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .insert(clients)
        .values({
          ...input,
          practiceId: ctx.practiceId,
          accessToken: generatePortalAccessToken(),
        })
        .returning();
      return client!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [client] = await ctx.db
        .update(clients)
        .set(data)
        .where(
          and(eq(clients.id, id), eq(clients.practiceId, ctx.practiceId))
        )
        .returning();
      return client!;
    }),

  delete: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(clients)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(clients.id, input.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  /** Create a portal token if missing; return URL. */
  ensurePortalAccess: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const client = await getClientForPractice(
        ctx.db,
        ctx.practiceId,
        input.id
      );
      let token = client.accessToken;
      if (!token) {
        token = generatePortalAccessToken();
        await ctx.db
          .update(clients)
          .set({ accessToken: token })
          .where(eq(clients.id, client.id));
      }
      return {
        accessToken: token,
        portalUrl: buildPortalUrl(token),
        portalEnabled: true,
      };
    }),

  regeneratePortalToken: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await getClientForPractice(ctx.db, ctx.practiceId, input.id);
      const token = generatePortalAccessToken();
      await ctx.db
        .update(clients)
        .set({ accessToken: token })
        .where(
          and(
            eq(clients.id, input.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        );
      return {
        accessToken: token,
        portalUrl: buildPortalUrl(token),
        portalEnabled: true,
      };
    }),

  disablePortalAccess: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await getClientForPractice(ctx.db, ctx.practiceId, input.id);
      await ctx.db
        .update(clients)
        .set({ accessToken: null })
        .where(
          and(
            eq(clients.id, input.id),
            eq(clients.practiceId, ctx.practiceId)
          )
        );
      return { portalEnabled: false, portalUrl: null };
    }),

  emailPortalLink: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      let client = await getClientForPractice(
        ctx.db,
        ctx.practiceId,
        input.id
      );
      if (!client.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client does not have an email address on file",
        });
      }
      let token = client.accessToken;
      if (!token) {
        token = generatePortalAccessToken();
        const [updated] = await ctx.db
          .update(clients)
          .set({ accessToken: token })
          .where(eq(clients.id, client.id))
          .returning();
        client = updated!;
      }

      const [practice] = await ctx.db
        .select({
          name: practices.name,
          phone: practices.phone,
          address: practices.address,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      const portalUrl = buildPortalUrl(token);
      const result = await sendPortalInviteEmail({
        to: client.email!,
        clientName: `${client.firstName} ${client.lastName}`,
        practiceName: practice?.name ?? "Your veterinary clinic",
        practicePhone: practice?.phone ?? undefined,
        practiceAddress: practice?.address ?? undefined,
        portalUrl,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Failed to send portal email",
        });
      }

      return { success: true, portalUrl, emailId: result.id ?? null };
    }),

  /** One-time backfill for clients missing a portal token. */
  backfillPortalTokens: protectedProcedure
    .use(requireRole("admin"))
    .mutation(async ({ ctx }) => {
      const missing = await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt),
            isNull(clients.accessToken)
          )
        );

      let updated = 0;
      for (const row of missing) {
        await ctx.db
          .update(clients)
          .set({ accessToken: generatePortalAccessToken() })
          .where(eq(clients.id, row.id));
        updated++;
      }
      return { updated };
    }),
});
