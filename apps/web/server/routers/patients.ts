import { z } from "zod";
import { eq, and, isNull, ilike, or, sql, desc, ne, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  assertNotStale,
  clientUpdatedAtSchema,
} from "../lib/optimistic-update";
import {
  patients,
  patientWeights,
  patientAllergies,
  patientAlerts,
  problemList,
  clients,
  users,
  appointments,
  soapNotes,
  vaccinationRecords,
  labResults,
  procedures,
  prescriptions,
  invoices,
} from "@openpims/db";
import { alias } from "drizzle-orm/pg-core";

export const patientsRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        species: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(patients.practiceId, ctx.practiceId),
        isNull(patients.deletedAt),
      ];

      if (input.search) {
        conditions.push(
          or(
            ilike(patients.name, `%${input.search}%`),
            ilike(patients.breed, `%${input.search}%`)
          )!
        );
      }
      if (input.species) {
        conditions.push(eq(patients.species, input.species as any));
      }
      if (input.status) {
        conditions.push(eq(patients.status, input.status as any));
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: patients.id,
            name: patients.name,
            species: patients.species,
            breed: patients.breed,
            sex: patients.sex,
            dob: patients.dob,
            status: patients.status,
            photoUrl: patients.photoUrl,
            clientId: patients.clientId,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
            createdAt: patients.createdAt,
          })
          .from(patients)
          .leftJoin(clients, eq(patients.clientId, clients.id))
          .where(and(...conditions))
          .orderBy(desc(patients.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
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
      // Split on whitespace so "Bella Smith" matches a pet named Bella with
      // owner Smith. Each token must match the pet name/breed or the owner's
      // first/last name; tokens are AND'd together.
      const tokens = input.query
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

      if (tokens.length === 0) return [];

      const tokenConditions = tokens.map((token) =>
        or(
          ilike(patients.name, `%${token}%`),
          ilike(patients.breed, `%${token}%`),
          ilike(clients.firstName, `%${token}%`),
          ilike(clients.lastName, `%${token}%`)
        )!
      );

      return ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
        })
        .from(patients)
        .leftJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt),
            ...tokenConditions
          )
        )
        .limit(10);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          sex: patients.sex,
          dob: patients.dob,
          color: patients.color,
          microchipNumber: patients.microchipNumber,
          photoUrl: patients.photoUrl,
          status: patients.status,
          clientId: patients.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          clientPhone: clients.phone,
          practiceId: patients.practiceId,
          createdAt: patients.createdAt,
        })
        .from(patients)
        .leftJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) throw new Error("Patient not found");

      const [weights, allergies] = await Promise.all([
        ctx.db
          .select()
          .from(patientWeights)
          .where(eq(patientWeights.patientId, input.id))
          .orderBy(desc(patientWeights.recordedAt)),
        ctx.db
          .select()
          .from(patientAllergies)
          .where(
            and(
              eq(patientAllergies.patientId, input.id),
              isNull(patientAllergies.deletedAt)
            )
          ),
      ]);

      return { ...patient, weights, allergies };
    }),

  /**
   * Returns a single bundled snapshot of a patient chart suitable for caching
   * locally on a tablet for offline read-only use. Queries are limited to a
   * recent window per record type to keep the payload small.
   */
  getOfflineSnapshot: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          sex: patients.sex,
          dob: patients.dob,
          color: patients.color,
          microchipNumber: patients.microchipNumber,
          photoUrl: patients.photoUrl,
          status: patients.status,
          clientId: patients.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          clientPhone: clients.phone,
        })
        .from(patients)
        .leftJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!patient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Patient not found",
        });
      }

      const now = new Date();

      const [
        weights,
        allergies,
        problems,
        vaccinations,
        prescriptionRows,
        soapNoteRows,
        labResultRows,
        procedureRows,
        alerts,
      ] = await Promise.all([
        ctx.db
          .select()
          .from(patientWeights)
          .where(eq(patientWeights.patientId, input.id))
          .orderBy(desc(patientWeights.recordedAt))
          .limit(50),
        ctx.db
          .select()
          .from(patientAllergies)
          .where(
            and(
              eq(patientAllergies.patientId, input.id),
              isNull(patientAllergies.deletedAt)
            )
          ),
        ctx.db
          .select()
          .from(problemList)
          .where(
            and(
              eq(problemList.patientId, input.id),
              eq(problemList.practiceId, ctx.practiceId),
              isNull(problemList.deletedAt)
            )
          )
          .orderBy(desc(problemList.createdAt)),
        ctx.db
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
              eq(vaccinationRecords.patientId, input.id),
              eq(vaccinationRecords.practiceId, ctx.practiceId),
              isNull(vaccinationRecords.deletedAt)
            )
          )
          .orderBy(desc(vaccinationRecords.administeredAt))
          .limit(50),
        ctx.db
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
              eq(prescriptions.patientId, input.id),
              eq(prescriptions.practiceId, ctx.practiceId),
              isNull(prescriptions.deletedAt)
            )
          )
          .orderBy(desc(prescriptions.createdAt))
          .limit(50),
        ctx.db
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
              eq(soapNotes.patientId, input.id),
              eq(soapNotes.practiceId, ctx.practiceId),
              isNull(soapNotes.deletedAt)
            )
          )
          .orderBy(desc(soapNotes.createdAt))
          .limit(20),
        ctx.db
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
              eq(labResults.patientId, input.id),
              eq(labResults.practiceId, ctx.practiceId),
              isNull(labResults.deletedAt)
            )
          )
          .orderBy(desc(labResults.createdAt))
          .limit(50),
        ctx.db
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
              eq(procedures.patientId, input.id),
              eq(procedures.practiceId, ctx.practiceId),
              isNull(procedures.deletedAt)
            )
          )
          .orderBy(desc(procedures.createdAt))
          .limit(50),
        ctx.db
          .select()
          .from(patientAlerts)
          .where(
            and(
              eq(patientAlerts.practiceId, ctx.practiceId),
              eq(patientAlerts.patientId, input.id),
              isNull(patientAlerts.deletedAt),
              or(
                isNull(patientAlerts.expiresAt),
                gt(patientAlerts.expiresAt, now)
              )!
            )
          )
          .orderBy(desc(patientAlerts.createdAt)),
      ]);

      return {
        patient,
        weights,
        allergies,
        problems,
        vaccinations,
        prescriptions: prescriptionRows,
        soapNotes: soapNoteRows,
        labResults: labResultRows,
        procedures: procedureRows,
        alerts,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientId: z.string().uuid(),
        name: z.string().min(1),
        species: z.enum([
          "canine",
          "feline",
          "avian",
          "rabbit",
          "reptile",
          "equine",
          "other",
        ]),
        breed: z.string().optional(),
        sex: z
          .enum(["male", "female", "male_neutered", "female_spayed"])
          .optional(),
        dob: z.string().optional(),
        color: z.string().optional(),
        microchipNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .insert(patients)
        .values({ ...input, practiceId: ctx.practiceId })
        .returning();
      return patient!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        species: z
          .enum([
            "canine",
            "feline",
            "avian",
            "rabbit",
            "reptile",
            "equine",
            "other",
          ])
          .optional(),
        breed: z.string().optional(),
        sex: z
          .enum(["male", "female", "male_neutered", "female_spayed"])
          .optional(),
        dob: z.string().optional(),
        color: z.string().optional(),
        microchipNumber: z.string().optional(),
        status: z.enum(["active", "inactive", "deceased"]).optional(),
        photoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [patient] = await ctx.db
        .update(patients)
        .set(data)
        .where(
          and(
            eq(patients.id, id),
            eq(patients.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return patient!;
    }),

  delete: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(patients)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(patients.id, input.id),
            eq(patients.practiceId, ctx.practiceId)
          )
        );
      return { success: true };
    }),

  addWeight: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        weightKg: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [weight] = await ctx.db
        .insert(patientWeights)
        .values({
          patientId: input.patientId,
          weightKg: input.weightKg,
          recordedBy: ctx.user.id,
        })
        .returning();
      return weight!;
    }),

  addAllergy: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        allergen: z.string().min(1),
        reaction: z.string().optional(),
        severity: z.enum(["mild", "moderate", "severe"]).default("moderate"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [allergy] = await ctx.db
        .insert(patientAllergies)
        .values({
          ...input,
          notedBy: ctx.user.id,
        })
        .returning();
      return allergy!;
    }),

  updateAllergy: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        allergen: z.string().min(1),
        reaction: z.string().optional(),
        severity: z.enum(["mild", "moderate", "severe"]),
        clientUpdatedAt: clientUpdatedAtSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientUpdatedAt, ...fields } = input;

      const [existing] = await ctx.db
        .select({
          id: patientAllergies.id,
          updatedAt: patientAllergies.updatedAt,
          patientId: patientAllergies.patientId,
        })
        .from(patientAllergies)
        .innerJoin(patients, eq(patientAllergies.patientId, patients.id))
        .where(
          and(
            eq(patientAllergies.id, id),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patientAllergies.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Allergy not found" });
      }

      assertNotStale(existing.updatedAt, clientUpdatedAt);

      const [allergy] = await ctx.db
        .update(patientAllergies)
        .set(fields)
        .where(eq(patientAllergies.id, id))
        .returning();
      return allergy!;
    }),

  deleteAllergy: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: patientAllergies.id })
        .from(patientAllergies)
        .innerJoin(patients, eq(patientAllergies.patientId, patients.id))
        .where(
          and(
            eq(patientAllergies.id, input.id),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patientAllergies.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Allergy not found" });
      }

      await ctx.db
        .update(patientAllergies)
        .set({ deletedAt: new Date() })
        .where(eq(patientAllergies.id, input.id));

      return { success: true };
    }),

  merge: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        keepId: z.string().uuid(),
        mergeId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.keepId === input.mergeId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot merge a patient into itself.",
        });
      }

      // Verify both patients exist in the practice
      const [keepPatient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.keepId),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!keepPatient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The patient to keep was not found.",
        });
      }

      const [mergePatient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(
          and(
            eq(patients.id, input.mergeId),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .limit(1);

      if (!mergePatient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The patient to merge was not found.",
        });
      }

      // Re-point all records from mergeId to keepId
      await Promise.all([
        ctx.db
          .update(appointments)
          .set({ patientId: input.keepId })
          .where(eq(appointments.patientId, input.mergeId)),
        ctx.db
          .update(soapNotes)
          .set({ patientId: input.keepId })
          .where(eq(soapNotes.patientId, input.mergeId)),
        ctx.db
          .update(vaccinationRecords)
          .set({ patientId: input.keepId })
          .where(eq(vaccinationRecords.patientId, input.mergeId)),
        ctx.db
          .update(labResults)
          .set({ patientId: input.keepId })
          .where(eq(labResults.patientId, input.mergeId)),
        ctx.db
          .update(procedures)
          .set({ patientId: input.keepId })
          .where(eq(procedures.patientId, input.mergeId)),
        ctx.db
          .update(prescriptions)
          .set({ patientId: input.keepId })
          .where(eq(prescriptions.patientId, input.mergeId)),
        ctx.db
          .update(patientWeights)
          .set({ patientId: input.keepId })
          .where(eq(patientWeights.patientId, input.mergeId)),
        ctx.db
          .update(patientAllergies)
          .set({ patientId: input.keepId })
          .where(eq(patientAllergies.patientId, input.mergeId)),
        ctx.db
          .update(invoices)
          .set({ patientId: input.keepId })
          .where(eq(invoices.patientId, input.mergeId)),
      ]);

      // Soft-delete the merged patient
      await ctx.db
        .update(patients)
        .set({ deletedAt: new Date() })
        .where(eq(patients.id, input.mergeId));

      // Return the kept patient
      const [kept] = await ctx.db
        .select()
        .from(patients)
        .where(eq(patients.id, input.keepId))
        .limit(1);

      return kept!;
    }),

  findDuplicates: protectedProcedure
    .query(async ({ ctx }) => {
      // Find patients with similar names within the practice.
      // Self-join patients table where names match via ILIKE and IDs differ.
      const p2 = alias(patients, "p2");

      const rows = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          clientId: patients.clientId,
          duplicateId: p2.id,
          duplicateName: p2.name,
          duplicateSpecies: p2.species,
          duplicateBreed: p2.breed,
          duplicateClientId: p2.clientId,
        })
        .from(patients)
        .innerJoin(
          p2,
          and(
            eq(patients.practiceId, p2.practiceId),
            ilike(patients.name, p2.name),
            ne(patients.id, p2.id),
            // Use id ordering to avoid returning both (A,B) and (B,A)
            sql`${patients.id} < ${p2.id}`
          )
        )
        .where(
          and(
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt),
            isNull(p2.deletedAt)
          )
        )
        .orderBy(patients.name)
        .limit(100);

      // Group into sets of potential duplicates
      const groupMap = new Map<
        string,
        {
          name: string;
          patients: {
            id: string;
            name: string;
            species: string;
            breed: string | null;
            clientId: string;
          }[];
        }
      >();

      for (const row of rows) {
        const key = row.name.toLowerCase();
        if (!groupMap.has(key)) {
          groupMap.set(key, { name: row.name, patients: [] });
        }
        const group = groupMap.get(key)!;
        // Add both sides if not already present
        if (!group.patients.some((p) => p.id === row.id)) {
          group.patients.push({
            id: row.id,
            name: row.name,
            species: row.species,
            breed: row.breed,
            clientId: row.clientId,
          });
        }
        if (!group.patients.some((p) => p.id === row.duplicateId)) {
          group.patients.push({
            id: row.duplicateId,
            name: row.duplicateName,
            species: row.duplicateSpecies,
            breed: row.duplicateBreed,
            clientId: row.duplicateClientId,
          });
        }
      }

      return Array.from(groupMap.values());
    }),
});
