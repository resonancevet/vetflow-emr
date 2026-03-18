import { z } from "zod";
import { eq, and, isNull, lt, gte, lte, sql, desc } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import {
  soapNotes,
  vaccinationRecords,
  patients,
  clients,
  appointments,
  invoices,
} from "@openpims/db";

export const aiRouter = createRouter({
  /**
   * AI SOAP Note Hook
   * External AI scribes (Scribenote, VetRec, HappyDoc) POST here
   * to auto-populate SOAP notes for a patient visit.
   */
  createSoapFromAI: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        subjective: z.string().optional(),
        objective: z.string().optional(),
        assessment: z.string().optional(),
        plan: z.string().optional(),
        source: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { source, ...noteData } = input;
      const [note] = await ctx.db
        .insert(soapNotes)
        .values({
          ...noteData,
          authorId: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return { ...note!, source };
    }),

  /**
   * Patients with overdue vaccinations
   * Returns patients whose most recent vaccination nextDueDate has passed.
   */
  patientsOverdueVaccinations: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10);

    const rows = await ctx.db
      .select({
        patientId: patients.id,
        patientName: patients.name,
        species: patients.species,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        vaccineName: vaccinationRecords.vaccineName,
        nextDueDate: vaccinationRecords.nextDueDate,
      })
      .from(vaccinationRecords)
      .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
      .leftJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
          isNull(patients.deletedAt),
          lt(vaccinationRecords.nextDueDate, today)
        )
      )
      .orderBy(vaccinationRecords.nextDueDate);

    return rows.map((r) => ({
      patientId: r.patientId,
      patientName: r.patientName,
      species: r.species,
      clientName: [r.clientFirstName, r.clientLastName]
        .filter(Boolean)
        .join(" "),
      vaccineName: r.vaccineName,
      nextDueDate: r.nextDueDate,
      daysOverdue: Math.floor(
        (Date.now() - new Date(r.nextDueDate!).getTime()) / 86_400_000
      ),
    }));
  }),

  /**
   * Patients needing follow-up
   * Appointments in the last 7 days with status "checked_out"
   * that have no future appointment for the same patient.
   */
  patientsNeedingFollowUp: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get checked-out appointments from last 7 days
    const recentCheckedOut = await ctx.db
      .select({
        appointmentId: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.name,
        species: patients.species,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        checkedOutAt: appointments.endTime,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          eq(appointments.status, "checked_out"),
          gte(appointments.startTime, sevenDaysAgo),
          lte(appointments.startTime, now)
        )
      )
      .orderBy(desc(appointments.startTime));

    // For each patient, check if there is a future appointment
    const patientIds = [
      ...new Set(recentCheckedOut.map((a) => a.patientId).filter(Boolean)),
    ];

    if (patientIds.length === 0) return [];

    const futureAppointments = await ctx.db
      .select({
        patientId: appointments.patientId,
        count: sql<number>`count(*)`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, now),
          sql`${appointments.patientId} = ANY(${patientIds})`
        )
      )
      .groupBy(appointments.patientId);

    const patientsWithFuture = new Set(
      futureAppointments.map((r) => r.patientId)
    );

    return recentCheckedOut
      .filter((a) => a.patientId && !patientsWithFuture.has(a.patientId))
      .map((a) => ({
        appointmentId: a.appointmentId,
        patientId: a.patientId,
        patientName: a.patientName,
        species: a.species,
        clientName: [a.clientFirstName, a.clientLastName]
          .filter(Boolean)
          .join(" "),
        lastVisit: a.checkedOutAt,
      }));
  }),

  /**
   * Daily practice summary
   * Aggregate view of today's activity for AI dashboard assistants.
   */
  dailySummary: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      appointmentsByStatus,
      soapNotesCreated,
      invoicesPaid,
    ] = await Promise.all([
      // Appointments by status
      ctx.db
        .select({
          status: appointments.status,
          count: sql<number>`count(*)`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd)
          )
        )
        .groupBy(appointments.status),

      // SOAP notes created today
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(soapNotes)
        .where(
          and(
            eq(soapNotes.practiceId, ctx.practiceId),
            isNull(soapNotes.deletedAt),
            gte(soapNotes.createdAt, todayStart),
            lte(soapNotes.createdAt, todayEnd)
          )
        ),

      // Invoices paid today
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt),
            eq(invoices.status, "paid"),
            gte(invoices.updatedAt, todayStart),
            lte(invoices.updatedAt, todayEnd)
          )
        ),
    ]);

    const statusMap = Object.fromEntries(
      appointmentsByStatus.map((r) => [r.status, Number(r.count)])
    );

    const totalAppointments = Object.values(statusMap).reduce(
      (a, b) => a + b,
      0
    );
    const patientsSeen = (statusMap["checked_out"] ?? 0) + (statusMap["in_exam"] ?? 0);

    return {
      date: todayStart.toISOString().slice(0, 10),
      appointments: {
        total: totalAppointments,
        byStatus: statusMap,
      },
      patientsSeen,
      soapNotesCreated: Number(soapNotesCreated[0]?.count ?? 0),
      invoicesPaid: Number(invoicesPaid[0]?.count ?? 0),
    };
  }),
});
