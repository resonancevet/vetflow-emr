import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { hash } from "bcryptjs";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  practices,
  users,
  appointmentTypes,
  rooms,
} from "@openpims/db";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

export const settingsRouter = createRouter({
  // ── Practice ──────────────────────────────────────────────

  getPractice: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select()
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    return practice ?? null;
  }),

  updatePractice: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(practices)
        .set(input)
        .where(eq(practices.id, ctx.practiceId))
        .returning();
      return updated!;
    }),

  // ── Staff / Users ─────────────────────────────────────────

  listUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        licenseNumber: users.licenseNumber,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(
        and(eq(users.practiceId, ctx.practiceId), isNull(users.deletedAt))
      );
  }),

  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "veterinarian", "technician", "front_desk"]),
        phone: z.string().optional(),
        licenseNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { password, ...rest } = input;
      const passwordHash = await hash(password, 12);
      const [user] = await ctx.db
        .insert(users)
        .values({
          ...rest,
          passwordHash,
          practiceId: ctx.practiceId,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        });
      return user!;
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        role: z
          .enum(["admin", "veterinarian", "technician", "front_desk"])
          .optional(),
        phone: z.string().optional(),
        licenseNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(users)
        .set(data)
        .where(
          and(eq(users.id, id), eq(users.practiceId, ctx.practiceId))
        )
        .returning();
      return updated!;
    }),

  deactivateUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(users.id, input.id),
            eq(users.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  // ── Appointment Types ─────────────────────────────────────

  listAppointmentTypes: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(appointmentTypes)
      .where(
        and(
          eq(appointmentTypes.practiceId, ctx.practiceId),
          isNull(appointmentTypes.deletedAt)
        )
      );
  }),

  createAppointmentType: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        durationMinutes: z.number().int().min(5).max(480),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        requiresDoctor: z.number().int().min(0).max(1).default(1),
        defaultRoomType: z
          .enum(["exam", "surgery", "treatment", "boarding"])
          .default("exam"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [type] = await ctx.db
        .insert(appointmentTypes)
        .values({ ...input, practiceId: ctx.practiceId })
        .returning();
      return type!;
    }),

  updateAppointmentType: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        durationMinutes: z.number().int().min(5).max(480).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        requiresDoctor: z.number().int().min(0).max(1).optional(),
        defaultRoomType: z
          .enum(["exam", "surgery", "treatment", "boarding"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(appointmentTypes)
        .set(data)
        .where(
          and(
            eq(appointmentTypes.id, id),
            eq(appointmentTypes.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return updated!;
    }),

  deleteAppointmentType: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(appointmentTypes)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(appointmentTypes.id, input.id),
            eq(appointmentTypes.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  // ── Rooms ─────────────────────────────────────────────────

  listRooms: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.practiceId, ctx.practiceId),
          isNull(rooms.deletedAt)
        )
      );
  }),

  createRoom: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["exam", "surgery", "treatment", "boarding"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [room] = await ctx.db
        .insert(rooms)
        .values({ ...input, practiceId: ctx.practiceId })
        .returning();
      return room!;
    }),

  deleteRoom: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rooms)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(rooms.id, input.id),
            eq(rooms.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),
});
