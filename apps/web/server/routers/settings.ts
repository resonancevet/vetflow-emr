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
import { writeAudit } from "../lib/audit";
import {
  getEffectiveTaxRatePercent,
  getTaxRatePercent,
  isTaxEnabled,
  type PracticeSettingsJson,
} from "@/lib/tax";
import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_META,
  getEmailTemplatesFromSettings,
  type EmailTemplateKey,
} from "@/lib/email-templates";

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

  /** Tax rate for invoice UI / anyone who can bill (not admin-only). */
  getBillingSettings: protectedProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    return {
      taxEnabled: isTaxEnabled(practice?.settings),
      taxRatePercent: getTaxRatePercent(practice?.settings),
      effectiveTaxRatePercent: getEffectiveTaxRatePercent(practice?.settings),
    };
  }),

  updatePractice: adminProcedure
    .input(
      z
        .object({
          name: z.string().min(1).optional(),
          address: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional(),
          website: z.string().optional(),
          timezone: z.string().optional(),
          scheduleStartHour: z.number().int().min(0).max(23).optional(),
          scheduleEndHour: z.number().int().min(1).max(24).optional(),
          taxRatePercent: z.number().min(0).max(100).optional(),
          taxEnabled: z.boolean().optional(),
        })
        .refine(
          (data) =>
            data.scheduleStartHour === undefined ||
            data.scheduleEndHour === undefined ||
            data.scheduleEndHour > data.scheduleStartHour,
          {
            message: "Schedule end time must be after the start time",
            path: ["scheduleEndHour"],
          }
        )
    )
    .mutation(async ({ ctx, input }) => {
      const { taxRatePercent, taxEnabled, ...practiceFields } = input;
      const setValues: Record<string, unknown> = { ...practiceFields };

      if (taxRatePercent !== undefined || taxEnabled !== undefined) {
        const [current] = await ctx.db
          .select({ settings: practices.settings })
          .from(practices)
          .where(eq(practices.id, ctx.practiceId))
          .limit(1);
        const existing =
          (current?.settings as PracticeSettingsJson | null) ?? {};
        setValues.settings = {
          ...existing,
          ...(taxRatePercent !== undefined ? { taxRatePercent } : {}),
          ...(taxEnabled !== undefined ? { taxEnabled } : {}),
        };
      }

      const [updated] = await ctx.db
        .update(practices)
        .set(setValues)
        .where(eq(practices.id, ctx.practiceId))
        .returning();
      return updated!;
    }),

  getEmailTemplates: adminProcedure.query(async ({ ctx }) => {
    const [practice] = await ctx.db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, ctx.practiceId))
      .limit(1);
    const templates = getEmailTemplatesFromSettings(practice?.settings);
    return EMAIL_TEMPLATE_META.map((meta) => ({
      ...meta,
      subject: templates[meta.key].subject,
      body: templates[meta.key].body,
      isCustom:
        JSON.stringify(templates[meta.key]) !==
        JSON.stringify(DEFAULT_EMAIL_TEMPLATES[meta.key]),
    }));
  }),

  updateEmailTemplate: adminProcedure
    .input(
      z.object({
        key: z.enum([
          "appointmentReminder",
          "appointmentConfirmation",
          "appointmentRequestDeclined",
          "portalMagicLink",
          "vaccinationReminder",
          "invoiceEmail",
        ]),
        subject: z.string().min(1).max(500),
        body: z.string().min(1).max(20000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const existing =
        (current?.settings as PracticeSettingsJson | null) ?? {};
      const emailTemplates = {
        ...((existing.emailTemplates as Record<string, unknown>) ?? {}),
        [input.key]: { subject: input.subject, body: input.body },
      };
      const [updated] = await ctx.db
        .update(practices)
        .set({
          settings: { ...existing, emailTemplates },
        })
        .where(eq(practices.id, ctx.practiceId))
        .returning({ settings: practices.settings });
      return getEmailTemplatesFromSettings(updated?.settings)[
        input.key as EmailTemplateKey
      ];
    }),

  resetEmailTemplate: adminProcedure
    .input(
      z.object({
        key: z.enum([
          "appointmentReminder",
          "appointmentConfirmation",
          "appointmentRequestDeclined",
          "portalMagicLink",
          "vaccinationReminder",
          "invoiceEmail",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const existing =
        (current?.settings as PracticeSettingsJson | null) ?? {};
      const emailTemplates = {
        ...((existing.emailTemplates as Record<string, unknown>) ?? {}),
      };
      delete emailTemplates[input.key];
      await ctx.db
        .update(practices)
        .set({
          settings: { ...existing, emailTemplates },
        })
        .where(eq(practices.id, ctx.practiceId));
      return DEFAULT_EMAIL_TEMPLATES[input.key as EmailTemplateKey];
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
      await writeAudit({
        practiceId: ctx.practiceId,
        userId: ctx.user.id,
        action: "staff.create",
        entityType: "user",
        entityId: user!.id,
        changes: { email: input.email, role: input.role },
        ipAddress: ctx.ipAddress,
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
      if (input.role) {
        await writeAudit({
          practiceId: ctx.practiceId,
          userId: ctx.user.id,
          action: "staff.role_change",
          entityType: "user",
          entityId: id,
          changes: { role: input.role },
          ipAddress: ctx.ipAddress,
        });
      }
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
