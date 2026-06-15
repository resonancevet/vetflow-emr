import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  examVitals,
  clientConsents,
  dischargeInstructions,
  treatmentAdministrations,
  patientCustody,
  anesthesiaRecords,
  procedureTeamMembers,
  users,
  clients,
} from "@openpims/db";
import { writeAudit } from "../lib/audit";

const examStatusSchema = z.enum(["wnl", "abnormal", "not_examined"]);
const consentDecisionSchema = z.enum(["consented", "declined"]);
const routeSchema = z.enum([
  "oral",
  "topical",
  "subcutaneous",
  "intramuscular",
  "intravenous",
  "other",
]);

export const complianceRouter = createRouter({
  // --- Exam vitals ---
  listExamVitals: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: examVitals.id,
          recordedAt: examVitals.recordedAt,
          weightKg: examVitals.weightKg,
          temperatureF: examVitals.temperatureF,
          heartRate: examVitals.heartRate,
          respiratoryRate: examVitals.respiratoryRate,
          examStatus: examVitals.examStatus,
          examNotes: examVitals.examNotes,
          recorderName: users.name,
          soapNoteId: examVitals.soapNoteId,
        })
        .from(examVitals)
        .leftJoin(users, eq(examVitals.recordedBy, users.id))
        .where(
          and(
            eq(examVitals.patientId, input.patientId),
            eq(examVitals.practiceId, ctx.practiceId),
            isNull(examVitals.deletedAt)
          )
        )
        .orderBy(desc(examVitals.recordedAt));
    }),

  createExamVitals: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        soapNoteId: z.string().uuid().optional(),
        weightKg: z.string().optional(),
        temperatureF: z.string().optional(),
        heartRate: z.number().int().optional(),
        respiratoryRate: z.number().int().optional(),
        examStatus: examStatusSchema.default("wnl"),
        examNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(examVitals)
        .values({
          ...input,
          practiceId: ctx.practiceId,
          recordedBy: ctx.user.id,
        })
        .returning();
      return row!;
    }),

  // --- Client consents ---
  listConsents: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: clientConsents.id,
          recommendation: clientConsents.recommendation,
          decision: clientConsents.decision,
          risks: clientConsents.risks,
          benefits: clientConsents.benefits,
          estimatedCost: clientConsents.estimatedCost,
          notes: clientConsents.notes,
          documentedAt: clientConsents.documentedAt,
          authorName: users.name,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
        })
        .from(clientConsents)
        .leftJoin(users, eq(clientConsents.authorId, users.id))
        .leftJoin(clients, eq(clientConsents.clientId, clients.id))
        .where(
          and(
            eq(clientConsents.patientId, input.patientId),
            eq(clientConsents.practiceId, ctx.practiceId),
            isNull(clientConsents.deletedAt)
          )
        )
        .orderBy(desc(clientConsents.documentedAt));
    }),

  createConsent: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        clientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        recommendation: z.string().trim().min(1),
        decision: consentDecisionSchema,
        risks: z.string().optional(),
        benefits: z.string().optional(),
        estimatedCost: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(clientConsents)
        .values({
          ...input,
          practiceId: ctx.practiceId,
          authorId: ctx.user.id,
        })
        .returning();
      await writeAudit({
        practiceId: ctx.practiceId,
        userId: ctx.user.id,
        action: "consent.create",
        entityType: "client_consent",
        entityId: row!.id,
        ipAddress: ctx.ipAddress,
      });
      return row!;
    }),

  // --- Discharge instructions ---
  listDischargeInstructions: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: dischargeInstructions.id,
          visitDate: dischargeInstructions.visitDate,
          diagnosis: dischargeInstructions.diagnosis,
          doctorName: dischargeInstructions.doctorName,
          medications: dischargeInstructions.medications,
          instructions: dischargeInstructions.instructions,
          followUpDate: dischargeInstructions.followUpDate,
          followUpNotes: dischargeInstructions.followUpNotes,
          restrictions: dischargeInstructions.restrictions,
          emergencyNotes: dischargeInstructions.emergencyNotes,
          pdfFileId: dischargeInstructions.pdfFileId,
          issuedAt: dischargeInstructions.issuedAt,
          authorName: users.name,
        })
        .from(dischargeInstructions)
        .leftJoin(users, eq(dischargeInstructions.authorId, users.id))
        .where(
          and(
            eq(dischargeInstructions.patientId, input.patientId),
            eq(dischargeInstructions.practiceId, ctx.practiceId),
            isNull(dischargeInstructions.deletedAt)
          )
        )
        .orderBy(desc(dischargeInstructions.issuedAt));
    }),

  createDischargeInstructions: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        visitDate: z.string(),
        diagnosis: z.string().optional(),
        doctorName: z.string().optional(),
        medications: z
          .array(
            z.object({
              name: z.string(),
              dosage: z.string(),
              frequency: z.string(),
              instructions: z.string().optional(),
            })
          )
          .optional(),
        instructions: z.array(z.string()).min(1),
        followUpDate: z.string().optional(),
        followUpNotes: z.string().optional(),
        restrictions: z.array(z.string()).optional(),
        emergencyNotes: z.string().optional(),
        pdfFileId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(dischargeInstructions)
        .values({
          ...input,
          practiceId: ctx.practiceId,
          authorId: ctx.user.id,
        })
        .returning();
      await writeAudit({
        practiceId: ctx.practiceId,
        userId: ctx.user.id,
        action: "discharge.create",
        entityType: "discharge_instructions",
        entityId: row!.id,
        ipAddress: ctx.ipAddress,
      });
      return row!;
    }),

  // --- Treatment administrations ---
  listTreatmentAdministrations: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: treatmentAdministrations.id,
          medicationName: treatmentAdministrations.medicationName,
          dosage: treatmentAdministrations.dosage,
          route: treatmentAdministrations.route,
          administeredAt: treatmentAdministrations.administeredAt,
          responseToTreatment: treatmentAdministrations.responseToTreatment,
          notes: treatmentAdministrations.notes,
          administratorName: users.name,
        })
        .from(treatmentAdministrations)
        .leftJoin(
          users,
          eq(treatmentAdministrations.administeredBy, users.id)
        )
        .where(
          and(
            eq(treatmentAdministrations.patientId, input.patientId),
            eq(treatmentAdministrations.practiceId, ctx.practiceId),
            isNull(treatmentAdministrations.deletedAt)
          )
        )
        .orderBy(desc(treatmentAdministrations.administeredAt));
    }),

  createTreatmentAdministration: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        medicationName: z.string().trim().min(1),
        dosage: z.string().optional(),
        route: routeSchema.optional(),
        administeredAt: z.string().datetime().optional(),
        responseToTreatment: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(treatmentAdministrations)
        .values({
          ...input,
          administeredAt: input.administeredAt
            ? new Date(input.administeredAt)
            : new Date(),
          practiceId: ctx.practiceId,
          administeredBy: ctx.user.id,
        })
        .returning();
      return row!;
    }),

  // --- Patient custody ---
  listCustody: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: patientCustody.id,
          custodyStart: patientCustody.custodyStart,
          custodyEnd: patientCustody.custodyEnd,
          reason: patientCustody.reason,
          notes: patientCustody.notes,
          recorderName: users.name,
        })
        .from(patientCustody)
        .leftJoin(users, eq(patientCustody.recordedBy, users.id))
        .where(
          and(
            eq(patientCustody.patientId, input.patientId),
            eq(patientCustody.practiceId, ctx.practiceId),
            isNull(patientCustody.deletedAt)
          )
        )
        .orderBy(desc(patientCustody.custodyStart));
    }),

  createCustody: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        custodyStart: z.string().datetime(),
        custodyEnd: z.string().datetime().optional(),
        reason: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(patientCustody)
        .values({
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          reason: input.reason,
          notes: input.notes,
          custodyStart: new Date(input.custodyStart),
          custodyEnd: input.custodyEnd ? new Date(input.custodyEnd) : null,
          practiceId: ctx.practiceId,
          recordedBy: ctx.user.id,
        })
        .returning();
      return row!;
    }),

  updateCustodyEnd: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        id: z.string().uuid(),
        custodyEnd: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(patientCustody)
        .set({ custodyEnd: new Date(input.custodyEnd) })
        .where(
          and(
            eq(patientCustody.id, input.id),
            eq(patientCustody.practiceId, ctx.practiceId),
            isNull(patientCustody.deletedAt)
          )
        )
        .returning();
      if (!row) throw new Error("Custody record not found");
      return row;
    }),

  // --- Anesthesia records ---
  listAnesthesiaRecords: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: anesthesiaRecords.id,
          procedureId: anesthesiaRecords.procedureId,
          startTime: anesthesiaRecords.startTime,
          endTime: anesthesiaRecords.endTime,
          protocol: anesthesiaRecords.protocol,
          vitalSignsLog: anesthesiaRecords.vitalSignsLog,
          complications: anesthesiaRecords.complications,
          notes: anesthesiaRecords.notes,
          recorderName: users.name,
          createdAt: anesthesiaRecords.createdAt,
        })
        .from(anesthesiaRecords)
        .leftJoin(users, eq(anesthesiaRecords.recordedBy, users.id))
        .where(
          and(
            eq(anesthesiaRecords.patientId, input.patientId),
            eq(anesthesiaRecords.practiceId, ctx.practiceId),
            isNull(anesthesiaRecords.deletedAt)
          )
        )
        .orderBy(desc(anesthesiaRecords.createdAt));
    }),

  createAnesthesiaRecord: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        procedureId: z.string().uuid().optional(),
        startTime: z.string().datetime().optional(),
        endTime: z.string().datetime().optional(),
        protocol: z.string().optional(),
        vitalSignsLog: z.string().optional(),
        complications: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(anesthesiaRecords)
        .values({
          patientId: input.patientId,
          procedureId: input.procedureId,
          protocol: input.protocol,
          vitalSignsLog: input.vitalSignsLog,
          complications: input.complications,
          notes: input.notes,
          startTime: input.startTime ? new Date(input.startTime) : null,
          endTime: input.endTime ? new Date(input.endTime) : null,
          practiceId: ctx.practiceId,
          recordedBy: ctx.user.id,
        })
        .returning();
      return row!;
    }),

  attachDischargePdf: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        id: z.string().uuid(),
        pdfFileId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(dischargeInstructions)
        .set({ pdfFileId: input.pdfFileId })
        .where(
          and(
            eq(dischargeInstructions.id, input.id),
            eq(dischargeInstructions.practiceId, ctx.practiceId),
            isNull(dischargeInstructions.deletedAt)
          )
        )
        .returning();
      if (!row) throw new Error("Discharge record not found");
      return row;
    }),

  listPracticeStaff: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(
        and(eq(users.practiceId, ctx.practiceId), isNull(users.deletedAt))
      )
      .orderBy(users.name);
  }),

  // --- Procedure team members ---
  listProcedureTeam: protectedProcedure
    .input(z.object({ procedureId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: procedureTeamMembers.id,
          userId: procedureTeamMembers.userId,
          role: procedureTeamMembers.role,
          userName: users.name,
        })
        .from(procedureTeamMembers)
        .leftJoin(users, eq(procedureTeamMembers.userId, users.id))
        .where(
          and(
            eq(procedureTeamMembers.procedureId, input.procedureId),
            isNull(procedureTeamMembers.deletedAt)
          )
        );
    }),

  addProcedureTeamMember: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        procedureId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(procedureTeamMembers)
        .values(input)
        .returning();
      return row!;
    }),

  removeProcedureTeamMember: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(procedureTeamMembers)
        .set({ deletedAt: new Date() })
        .where(eq(procedureTeamMembers.id, input.id))
        .returning();
      if (!row) throw new Error("Team member not found");
      return row;
    }),
});
