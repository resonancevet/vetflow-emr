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
});
