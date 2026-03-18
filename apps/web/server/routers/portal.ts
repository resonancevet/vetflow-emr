import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicProcedure } from "../trpc";
import {
  clients,
  patients,
  patientWeights,
  patientAllergies,
  vaccinationRecords,
  prescriptions,
  appointments,
  appointmentTypes,
  invoices,
  communications,
} from "@openpims/db";
import { users } from "@openpims/db";

async function getClientByToken(db: any, token: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.accessToken, token), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid portal link",
    });
  }

  return client;
}

export const portalRouter = createRouter({
  getClient: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const clientPatients = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          dob: patients.dob,
          color: patients.color,
          sex: patients.sex,
          photoUrl: patients.photoUrl,
          status: patients.status,
        })
        .from(patients)
        .where(
          and(
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt),
            eq(patients.status, "active")
          )
        );

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        patients: clientPatients,
      };
    }),

  getPetDetail: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        patientId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet not found",
        });
      }

      const [weights, allergies, vaccinations, activeRx] = await Promise.all([
        ctx.db
          .select({
            id: patientWeights.id,
            weightKg: patientWeights.weightKg,
            recordedAt: patientWeights.recordedAt,
          })
          .from(patientWeights)
          .where(eq(patientWeights.patientId, input.patientId))
          .orderBy(desc(patientWeights.recordedAt)),

        ctx.db
          .select({
            id: patientAllergies.id,
            allergen: patientAllergies.allergen,
            reaction: patientAllergies.reaction,
            severity: patientAllergies.severity,
          })
          .from(patientAllergies)
          .where(eq(patientAllergies.patientId, input.patientId)),

        ctx.db
          .select({
            id: vaccinationRecords.id,
            vaccineName: vaccinationRecords.vaccineName,
            administeredAt: vaccinationRecords.administeredAt,
            nextDueDate: vaccinationRecords.nextDueDate,
          })
          .from(vaccinationRecords)
          .where(eq(vaccinationRecords.patientId, input.patientId))
          .orderBy(desc(vaccinationRecords.administeredAt)),

        ctx.db
          .select({
            id: prescriptions.id,
            medicationName: prescriptions.medicationName,
            dosage: prescriptions.dosage,
            frequency: prescriptions.frequency,
            startDate: prescriptions.startDate,
            endDate: prescriptions.endDate,
            instructions: prescriptions.instructions,
            status: prescriptions.status,
            refillsRemaining: prescriptions.refillsRemaining,
          })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.patientId, input.patientId),
              eq(prescriptions.status, "active")
            )
          ),
      ]);

      return {
        ...patient,
        weights,
        allergies,
        vaccinations,
        prescriptions: activeRx,
      };
    }),

  getAppointments: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const rows = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          patientName: patients.name,
          patientSpecies: patients.species,
          doctorName: users.name,
          typeName: appointmentTypes.name,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(users, eq(appointments.doctorId, users.id))
        .leftJoin(appointmentTypes, eq(appointments.typeId, appointmentTypes.id))
        .where(eq(appointments.clientId, client.id))
        .orderBy(desc(appointments.startTime));

      return rows;
    }),

  getInvoices: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      const rows = await ctx.db
        .select({
          id: invoices.id,
          status: invoices.status,
          subtotal: invoices.subtotal,
          tax: invoices.tax,
          total: invoices.total,
          paidAmount: invoices.paidAmount,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt,
          patientName: patients.name,
        })
        .from(invoices)
        .leftJoin(patients, eq(invoices.patientId, patients.id))
        .where(and(eq(invoices.clientId, client.id), isNull(invoices.deletedAt)))
        .orderBy(desc(invoices.createdAt));

      return rows;
    }),

  requestAppointment: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        patientId: z.string().uuid(),
        preferredDate: z.string(),
        preferredTime: z.string(),
        reason: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByToken(ctx.db, input.token);

      // Verify the patient belongs to this client
      const [patient] = await ctx.db
        .select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.patientId),
            eq(patients.clientId, client.id),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pet not found",
        });
      }

      // Create a communication record for the appointment request
      await ctx.db.insert(communications).values({
        practiceId: client.practiceId,
        clientId: client.id,
        channel: "portal",
        direction: "inbound",
        subject: `Appointment request for ${patient.name}`,
        content: [
          `Pet: ${patient.name}`,
          `Preferred date: ${input.preferredDate}`,
          `Preferred time: ${input.preferredTime}`,
          `Reason: ${input.reason}`,
        ].join("\n"),
        status: "pending",
      });

      return {
        success: true,
        message:
          "Your appointment request has been sent! The clinic will confirm your appointment.",
      };
    }),
});
