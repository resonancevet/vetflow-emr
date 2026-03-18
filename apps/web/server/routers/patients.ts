import { z } from "zod";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  patients,
  patientWeights,
  patientAllergies,
  clients,
} from "@openpims/db";

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
});
