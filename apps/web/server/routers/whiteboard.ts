import { z } from "zod";
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import {
  appointments,
  patients,
  clients,
  users,
  appointmentTypes,
  rooms,
} from "@openpims/db";

export const whiteboardRouter = createRouter({
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return ctx.db
      .select({
        id: appointments.id,
        status: appointments.status,
        startTime: appointments.startTime,
        notes: appointments.notes,
        patientName: patients.name,
        patientSpecies: patients.species,
        patientPhotoUrl: patients.photoUrl,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        doctorName: users.name,
        roomName: rooms.name,
        typeName: appointmentTypes.name,
        typeColor: appointmentTypes.color,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
      .leftJoin(rooms, eq(appointments.roomId, rooms.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, startOfDay),
          lte(appointments.startTime, endOfDay),
          inArray(appointments.status, [
            "confirmed",
            "checked_in",
            "in_exam",
            "checked_out",
          ])
        )
      )
      .orderBy(appointments.startTime);
  }),

  updateStatus: protectedProcedure
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
});
