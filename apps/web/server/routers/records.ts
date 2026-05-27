import { z } from "zod";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  soapNotes,
  vaccinationRecords,
  labResults,
  procedures,
  problemList,
  prescriptions,
  patients,
  users,
  files,
} from "@openpims/db";
import { deleteFile as deleteFileFromS3 } from "@/lib/s3";
import {
  assertNotStale,
  clientUpdatedAtSchema,
} from "../lib/optimistic-update";

export const recordsRouter = createRouter({
  // SOAP Notes
  listSoapNotes: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: soapNotes.id,
          subjective: soapNotes.subjective,
          objective: soapNotes.objective,
          assessment: soapNotes.assessment,
          plan: soapNotes.plan,
          authorName: users.name,
          createdAt: soapNotes.createdAt,
          updatedAt: soapNotes.updatedAt,
        })
        .from(soapNotes)
        .leftJoin(users, eq(soapNotes.authorId, users.id))
        .where(
          and(
            eq(soapNotes.patientId, input.patientId),
            eq(soapNotes.practiceId, ctx.practiceId),
            isNull(soapNotes.deletedAt)
          )
        )
        .orderBy(desc(soapNotes.createdAt));
    }),

  createSoapNote: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        subjective: z.string().optional(),
        objective: z.string().optional(),
        assessment: z.string().optional(),
        plan: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [note] = await ctx.db
        .insert(soapNotes)
        .values({
          ...input,
          authorId: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return note!;
    }),

  updateSoapNote: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        subjective: z.string().optional(),
        objective: z.string().optional(),
        assessment: z.string().optional(),
        plan: z.string().optional(),
        clientUpdatedAt: clientUpdatedAtSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientUpdatedAt, ...fields } = input;

      const [existing] = await ctx.db
        .select({ updatedAt: soapNotes.updatedAt })
        .from(soapNotes)
        .where(
          and(
            eq(soapNotes.id, id),
            eq(soapNotes.practiceId, ctx.practiceId),
            isNull(soapNotes.deletedAt)
          )
        )
        .limit(1);

      if (!existing) throw new Error("SOAP note not found");
      assertNotStale(existing.updatedAt, clientUpdatedAt);

      // Empty string is a valid "clear this section" value, so we let it
      // through; only undefined fields are skipped.
      const updateValues: Record<string, string> = {};
      for (const key of ["subjective", "objective", "assessment", "plan"] as const) {
        const value = fields[key];
        if (value !== undefined) updateValues[key] = value;
      }
      const [note] = await ctx.db
        .update(soapNotes)
        .set(updateValues)
        .where(
          and(
            eq(soapNotes.id, id),
            eq(soapNotes.practiceId, ctx.practiceId),
            isNull(soapNotes.deletedAt)
          )
        )
        .returning();
      if (!note) throw new Error("SOAP note not found");
      return note;
    }),

  listFilesForEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.string().min(1),
        entityId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: files.id,
          fileName: files.fileName,
          fileKey: files.fileKey,
          mimeType: files.mimeType,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(
          and(
            eq(files.practiceId, ctx.practiceId),
            eq(files.entityType, input.entityType),
            eq(files.entityId, input.entityId),
            isNull(files.deletedAt)
          )
        )
        .orderBy(desc(files.createdAt));

      // Hand back a path to our own proxy route instead of a presigned S3
      // URL — see apps/web/app/api/files/[id]/route.ts for why.
      return rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        createdAt: row.createdAt,
        fileUrl: `/api/files/${row.id}`,
      }));
    }),

  renameFile: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        fileName: z.string().trim().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .update(files)
        .set({ fileName: input.fileName })
        .where(
          and(
            eq(files.id, input.id),
            eq(files.practiceId, ctx.practiceId),
            isNull(files.deletedAt)
          )
        )
        .returning({ id: files.id, fileName: files.fileName });
      if (!row) throw new Error("File not found");
      return row;
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Soft-delete the metadata first so the UI hides it immediately even if
      // the S3 object delete races or fails.
      const [row] = await ctx.db
        .update(files)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(files.id, input.id),
            eq(files.practiceId, ctx.practiceId),
            isNull(files.deletedAt)
          )
        )
        .returning({ id: files.id, fileKey: files.fileKey });
      if (!row) throw new Error("File not found");

      try {
        await deleteFileFromS3(row.fileKey);
      } catch (err) {
        console.error("Failed to delete object from S3:", err);
      }
      return { id: row.id };
    }),

  // Vaccinations
  listVaccinations: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: vaccinationRecords.id,
          vaccineName: vaccinationRecords.vaccineName,
          lotNumber: vaccinationRecords.lotNumber,
          manufacturer: vaccinationRecords.manufacturer,
          administeredAt: vaccinationRecords.administeredAt,
          nextDueDate: vaccinationRecords.nextDueDate,
          administeredByName: users.name,
        })
        .from(vaccinationRecords)
        .leftJoin(users, eq(vaccinationRecords.administeredBy, users.id))
        .where(
          and(
            eq(vaccinationRecords.patientId, input.patientId),
            eq(vaccinationRecords.practiceId, ctx.practiceId),
            isNull(vaccinationRecords.deletedAt)
          )
        )
        .orderBy(desc(vaccinationRecords.administeredAt));
    }),

  createVaccination: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        vaccineName: z.string().min(1),
        lotNumber: z.string().optional(),
        manufacturer: z.string().optional(),
        nextDueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .insert(vaccinationRecords)
        .values({
          ...input,
          administeredBy: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return record!;
    }),

  updateVaccination: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        id: z.string().uuid(),
        vaccineName: z.string().min(1),
        lotNumber: z.string().optional(),
        manufacturer: z.string().optional(),
        nextDueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [record] = await ctx.db
        .update(vaccinationRecords)
        .set({
          ...fields,
          lotNumber: fields.lotNumber || null,
          manufacturer: fields.manufacturer || null,
          nextDueDate: fields.nextDueDate || null,
        })
        .where(
          and(
            eq(vaccinationRecords.id, id),
            eq(vaccinationRecords.practiceId, ctx.practiceId),
            isNull(vaccinationRecords.deletedAt)
          )
        )
        .returning();
      if (!record) throw new Error("Vaccination not found");
      return record;
    }),

  deleteVaccination: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [record] = await ctx.db
        .update(vaccinationRecords)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(vaccinationRecords.id, input.id),
            eq(vaccinationRecords.practiceId, ctx.practiceId),
            isNull(vaccinationRecords.deletedAt)
          )
        )
        .returning();
      if (!record) throw new Error("Vaccination not found");
      return record;
    }),

  // Problem List
  listProblems: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(problemList)
        .where(
          and(
            eq(problemList.patientId, input.patientId),
            eq(problemList.practiceId, ctx.practiceId),
            isNull(problemList.deletedAt)
          )
        )
        .orderBy(desc(problemList.createdAt));
    }),

  createProblem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        description: z.string().min(1),
        status: z.enum(["active", "resolved", "chronic"]).default("active"),
        onsetDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [problem] = await ctx.db
        .insert(problemList)
        .values({
          ...input,
          practiceId: ctx.practiceId,
        })
        .returning();
      return problem!;
    }),

  updateProblemStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["active", "resolved", "chronic"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [problem] = await ctx.db
        .update(problemList)
        .set({
          status: input.status,
          resolvedDate:
            input.status === "resolved"
              ? new Date().toISOString().slice(0, 10)
              : null,
        })
        .where(
          and(
            eq(problemList.id, input.id),
            eq(problemList.practiceId, ctx.practiceId),
            isNull(problemList.deletedAt)
          )
        )
        .returning();
      if (!problem) throw new Error("Problem not found");
      return problem!;
    }),

  updateProblem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().min(1),
        status: z.enum(["active", "resolved", "chronic"]),
        onsetDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [problem] = await ctx.db
        .update(problemList)
        .set({
          description: input.description,
          status: input.status,
          onsetDate: input.onsetDate || null,
          resolvedDate:
            input.status === "resolved"
              ? new Date().toISOString().slice(0, 10)
              : null,
        })
        .where(
          and(
            eq(problemList.id, input.id),
            eq(problemList.practiceId, ctx.practiceId),
            isNull(problemList.deletedAt)
          )
        )
        .returning();
      if (!problem) throw new Error("Problem not found");
      return problem;
    }),

  deleteProblem: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [problem] = await ctx.db
        .update(problemList)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(problemList.id, input.id),
            eq(problemList.practiceId, ctx.practiceId),
            isNull(problemList.deletedAt)
          )
        )
        .returning();
      if (!problem) throw new Error("Problem not found");
      return problem;
    }),

  // Prescriptions
  listPrescriptions: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: prescriptions.id,
          medicationName: prescriptions.medicationName,
          dosage: prescriptions.dosage,
          frequency: prescriptions.frequency,
          quantity: prescriptions.quantity,
          refillsRemaining: prescriptions.refillsRemaining,
          startDate: prescriptions.startDate,
          endDate: prescriptions.endDate,
          status: prescriptions.status,
          instructions: prescriptions.instructions,
          prescriberName: users.name,
          createdAt: prescriptions.createdAt,
        })
        .from(prescriptions)
        .leftJoin(users, eq(prescriptions.prescribedBy, users.id))
        .where(
          and(
            eq(prescriptions.patientId, input.patientId),
            eq(prescriptions.practiceId, ctx.practiceId),
            isNull(prescriptions.deletedAt)
          )
        )
        .orderBy(desc(prescriptions.createdAt));
    }),

  createPrescription: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        medicationName: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        quantity: z.number().optional(),
        refillsRemaining: z.number().default(0),
        startDate: z.string(),
        endDate: z.string().optional(),
        instructions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rx] = await ctx.db
        .insert(prescriptions)
        .values({
          ...input,
          prescribedBy: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return rx!;
    }),

  updatePrescription: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        medicationName: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        quantity: z.number().int().optional(),
        refillsRemaining: z.number().int().default(0),
        startDate: z.string(),
        endDate: z.string().optional(),
        status: z.enum(["active", "completed", "cancelled", "expired"]),
        instructions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [rx] = await ctx.db
        .update(prescriptions)
        .set({
          ...fields,
          quantity: fields.quantity ?? null,
          endDate: fields.endDate || null,
          instructions: fields.instructions || null,
        })
        .where(
          and(
            eq(prescriptions.id, id),
            eq(prescriptions.practiceId, ctx.practiceId),
            isNull(prescriptions.deletedAt)
          )
        )
        .returning();
      if (!rx) throw new Error("Prescription not found");
      return rx;
    }),

  deletePrescription: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [rx] = await ctx.db
        .update(prescriptions)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(prescriptions.id, input.id),
            eq(prescriptions.practiceId, ctx.practiceId),
            isNull(prescriptions.deletedAt)
          )
        )
        .returning();
      if (!rx) throw new Error("Prescription not found");
      return rx;
    }),

  // Lab Results
  listLabResults: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: labResults.id,
          testName: labResults.testName,
          resultValue: labResults.resultValue,
          unit: labResults.unit,
          referenceRangeLow: labResults.referenceRangeLow,
          referenceRangeHigh: labResults.referenceRangeHigh,
          status: labResults.status,
          orderedByName: users.name,
          createdAt: labResults.createdAt,
        })
        .from(labResults)
        .leftJoin(users, eq(labResults.orderedBy, users.id))
        .where(
          and(
            eq(labResults.patientId, input.patientId),
            eq(labResults.practiceId, ctx.practiceId),
            isNull(labResults.deletedAt)
          )
        )
        .orderBy(desc(labResults.createdAt));
      return rows;
    }),

  createLabResult: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        testName: z.string().min(1),
        resultValue: z.string().optional(),
        unit: z.string().optional(),
        referenceRangeLow: z.string().optional(),
        referenceRangeHigh: z.string().optional(),
        status: z.enum(["pending", "completed", "reviewed"]).default("pending"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .insert(labResults)
        .values({
          ...input,
          orderedBy: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return result!;
    }),

  updateLabResultStatus: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["pending", "completed", "reviewed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .update(labResults)
        .set({
          status: input.status,
          ...(input.status === "reviewed"
            ? { reviewedBy: ctx.user.id }
            : {}),
        })
        .where(
          and(
            eq(labResults.id, input.id),
            eq(labResults.practiceId, ctx.practiceId),
            isNull(labResults.deletedAt)
          )
        )
        .returning();
      if (!result) throw new Error("Lab result not found");
      return result;
    }),

  updateLabResult: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        testName: z.string().min(1),
        resultValue: z.string().optional(),
        unit: z.string().optional(),
        referenceRangeLow: z.string().optional(),
        referenceRangeHigh: z.string().optional(),
        status: z.enum(["pending", "completed", "reviewed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [result] = await ctx.db
        .update(labResults)
        .set({
          testName: fields.testName,
          resultValue: fields.resultValue || null,
          unit: fields.unit || null,
          referenceRangeLow: fields.referenceRangeLow || null,
          referenceRangeHigh: fields.referenceRangeHigh || null,
          status: fields.status,
          ...(fields.status === "reviewed"
            ? { reviewedBy: ctx.user.id }
            : {}),
        })
        .where(
          and(
            eq(labResults.id, id),
            eq(labResults.practiceId, ctx.practiceId),
            isNull(labResults.deletedAt)
          )
        )
        .returning();
      if (!result) throw new Error("Lab result not found");
      return result;
    }),

  deleteLabResult: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .update(labResults)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(labResults.id, input.id),
            eq(labResults.practiceId, ctx.practiceId),
            isNull(labResults.deletedAt)
          )
        )
        .returning();
      if (!result) throw new Error("Lab result not found");
      return result;
    }),

  // Procedures
  listProcedures: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: procedures.id,
          name: procedures.name,
          description: procedures.description,
          performedByName: users.name,
          anesthesiaUsed: procedures.anesthesiaUsed,
          durationMinutes: procedures.durationMinutes,
          notes: procedures.notes,
          createdAt: procedures.createdAt,
        })
        .from(procedures)
        .leftJoin(users, eq(procedures.performedBy, users.id))
        .where(
          and(
            eq(procedures.patientId, input.patientId),
            eq(procedures.practiceId, ctx.practiceId),
            isNull(procedures.deletedAt)
          )
        )
        .orderBy(desc(procedures.createdAt));
    }),

  createProcedure: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        patientId: z.string().uuid(),
        appointmentId: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        anesthesiaUsed: z.string().optional(),
        durationMinutes: z.number().int().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [procedure] = await ctx.db
        .insert(procedures)
        .values({
          ...input,
          performedBy: ctx.user.id,
          practiceId: ctx.practiceId,
        })
        .returning();
      return procedure!;
    }),

  updateProcedure: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        anesthesiaUsed: z.string().optional(),
        durationMinutes: z.number().int().positive().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [procedure] = await ctx.db
        .update(procedures)
        .set({
          name: fields.name,
          description: fields.description || null,
          anesthesiaUsed: fields.anesthesiaUsed || null,
          durationMinutes: fields.durationMinutes ?? null,
          notes: fields.notes || null,
        })
        .where(
          and(
            eq(procedures.id, id),
            eq(procedures.practiceId, ctx.practiceId),
            isNull(procedures.deletedAt)
          )
        )
        .returning();
      if (!procedure) throw new Error("Procedure not found");
      return procedure;
    }),

  deleteProcedure: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [procedure] = await ctx.db
        .update(procedures)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(procedures.id, input.id),
            eq(procedures.practiceId, ctx.practiceId),
            isNull(procedures.deletedAt)
          )
        )
        .returning();
      if (!procedure) throw new Error("Procedure not found");
      return procedure;
    }),
});
