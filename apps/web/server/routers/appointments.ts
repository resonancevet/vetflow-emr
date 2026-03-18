import { z } from "zod";
import { eq, and, isNull, gte, lte, sql, desc, not, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  appointments,
  appointmentTypes,
  patients,
  clients,
  users,
  rooms,
  recurringSeries,
} from "@openpims/db";

export const appointmentsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        doctorId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(appointments.practiceId, ctx.practiceId),
        isNull(appointments.deletedAt),
        gte(appointments.startTime, new Date(input.startDate)),
        lte(appointments.startTime, new Date(input.endDate)),
      ];

      if (input.doctorId) {
        conditions.push(eq(appointments.doctorId, input.doctorId));
      }

      return ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientSpecies: patients.species,
          patientId: appointments.patientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientId: appointments.clientId,
          doctorName: users.name,
          doctorId: appointments.doctorId,
          typeName: appointmentTypes.name,
          typeColor: appointmentTypes.color,
          typeDuration: appointmentTypes.durationMinutes,
          roomName: rooms.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .where(and(...conditions))
        .orderBy(appointments.startTime);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [appt] = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientId: appointments.patientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientId: appointments.clientId,
          doctorName: users.name,
          doctorId: appointments.doctorId,
          typeName: appointmentTypes.name,
          typeColor: appointmentTypes.color,
          roomName: rooms.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .leftJoin(rooms, eq(appointments.roomId, rooms.id))
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!appt) throw new Error("Appointment not found");
      return appt;
    }),

  create: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        startTime: z.string(),
        endTime: z.string(),
        typeId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        doctorId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for conflicts with existing appointments for the same doctor
      if (input.doctorId) {
        const startTime = new Date(input.startTime);
        const endTime = new Date(input.endTime);

        const conflicts = await ctx.db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.practiceId, ctx.practiceId),
              eq(appointments.doctorId, input.doctorId),
              isNull(appointments.deletedAt),
              // Overlapping: existing.start < new.end AND existing.end > new.start
              lte(appointments.startTime, endTime),
              gte(appointments.endTime, startTime),
              // Exclude cancelled/no-show
              not(inArray(appointments.status, ["cancelled", "no_show"]))
            )
          )
          .limit(1);

        if (conflicts.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This time slot conflicts with an existing appointment for this doctor.",
          });
        }
      }

      const [appt] = await ctx.db
        .insert(appointments)
        .values({
          ...input,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          practiceId: ctx.practiceId,
        })
        .returning();
      return appt!;
    }),

  updateStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "scheduled",
          "confirmed",
          "checked_in",
          "in_exam",
          "checked_out",
          "no_show",
          "cancelled",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [appt] = await ctx.db
        .update(appointments)
        .set({ status: input.status })
        .where(
          and(
            eq(appointments.id, input.id),
            eq(appointments.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return appt!;
    }),

  listTypes: protectedProcedure.query(async ({ ctx }) => {
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

  listDoctors: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.practiceId, ctx.practiceId),
          eq(users.role, "veterinarian"),
          isNull(users.deletedAt)
        )
      );
  }),

  listRooms: protectedProcedure.query(async ({ ctx }) => {
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

  createRecurring: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid(),
        doctorId: z.string().uuid().optional(),
        typeId: z.string().uuid().optional(),
        roomId: z.string().uuid().optional(),
        startTime: z.string(),
        endTime: z.string(),
        frequency: z.enum(["weekly", "monthly", "annual"]),
        interval: z.number().int().min(1),
        occurrences: z.number().int().min(1).max(52),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Calculate the duration of a single appointment
      const firstStart = new Date(input.startTime);
      const firstEnd = new Date(input.endTime);
      const durationMs = firstEnd.getTime() - firstStart.getTime();

      if (durationMs <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time.",
        });
      }

      // Create the recurring series record
      // Calculate the last occurrence date for the series endDate
      const lastOccurrenceDate = computeOccurrenceDate(
        firstStart,
        input.frequency,
        input.interval,
        input.occurrences - 1
      );

      const [series] = await ctx.db
        .insert(recurringSeries)
        .values({
          practiceId: ctx.practiceId,
          frequency: input.frequency,
          interval: input.interval,
          endDate: lastOccurrenceDate.toISOString().split("T")[0]!,
        })
        .returning();

      let created = 0;
      let skipped = 0;

      for (let i = 0; i < input.occurrences; i++) {
        const occStart = computeOccurrenceDate(
          firstStart,
          input.frequency,
          input.interval,
          i
        );
        const occEnd = new Date(occStart.getTime() + durationMs);

        // Check for conflicts if a doctor is assigned
        if (input.doctorId) {
          const conflicts = await ctx.db
            .select({ id: appointments.id })
            .from(appointments)
            .where(
              and(
                eq(appointments.practiceId, ctx.practiceId),
                eq(appointments.doctorId, input.doctorId),
                isNull(appointments.deletedAt),
                lte(appointments.startTime, occEnd),
                gte(appointments.endTime, occStart),
                not(inArray(appointments.status, ["cancelled", "no_show"]))
              )
            )
            .limit(1);

          if (conflicts.length > 0) {
            skipped++;
            continue;
          }
        }

        await ctx.db.insert(appointments).values({
          practiceId: ctx.practiceId,
          patientId: input.patientId,
          clientId: input.clientId,
          doctorId: input.doctorId,
          typeId: input.typeId,
          roomId: input.roomId,
          startTime: occStart,
          endTime: occEnd,
          notes: input.notes,
          recurringSeriesId: series!.id,
        });

        created++;
      }

      return { seriesId: series!.id, created, skipped };
    }),
});

/** Compute the start date/time for the Nth occurrence (0-based). */
function computeOccurrenceDate(
  baseDate: Date,
  frequency: "weekly" | "monthly" | "annual",
  interval: number,
  n: number
): Date {
  const d = new Date(baseDate);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7 * interval * n);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + interval * n);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + interval * n);
      break;
  }
  return d;
}
