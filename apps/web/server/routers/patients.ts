import { z } from "zod";
import { eq, and, isNull, ilike, or, sql, desc, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  patients,
  patientWeights,
  patientAllergies,
  clients,
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
            or(
              ilike(patients.name, `%${input.query}%`),
              ilike(patients.breed, `%${input.query}%`)
            )
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
