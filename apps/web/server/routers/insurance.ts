import { z } from "zod";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  insurancePolicies,
  insuranceClaims,
  clients,
  patients,
} from "@openpims/db";

export const insuranceRouter = createRouter({
  listPolicies: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(insurancePolicies.practiceId, ctx.practiceId),
        isNull(insurancePolicies.deletedAt),
      ];

      if (input.patientId) {
        conditions.push(eq(insurancePolicies.patientId, input.patientId));
      }

      return ctx.db
        .select({
          id: insurancePolicies.id,
          providerName: insurancePolicies.providerName,
          policyNumber: insurancePolicies.policyNumber,
          groupNumber: insurancePolicies.groupNumber,
          phoneNumber: insurancePolicies.phoneNumber,
          coverageType: insurancePolicies.coverageType,
          deductible: insurancePolicies.deductible,
          coveragePercent: insurancePolicies.coveragePercent,
          maxAnnualBenefit: insurancePolicies.maxAnnualBenefit,
          effectiveDate: insurancePolicies.effectiveDate,
          expirationDate: insurancePolicies.expirationDate,
          notes: insurancePolicies.notes,
          createdAt: insurancePolicies.createdAt,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          patientName: patients.name,
        })
        .from(insurancePolicies)
        .leftJoin(clients, eq(insurancePolicies.clientId, clients.id))
        .leftJoin(patients, eq(insurancePolicies.patientId, patients.id))
        .where(and(...conditions))
        .orderBy(desc(insurancePolicies.createdAt));
    }),

  createPolicy: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid(),
        patientId: z.string().uuid(),
        providerName: z.string().min(1).max(255),
        policyNumber: z.string().max(128).optional(),
        groupNumber: z.string().max(128).optional(),
        phoneNumber: z.string().max(32).optional(),
        coverageType: z.string().max(128).optional(),
        deductible: z.string().optional(),
        coveragePercent: z.number().min(0).max(100).optional(),
        maxAnnualBenefit: z.string().optional(),
        effectiveDate: z.string().optional(),
        expirationDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [policy] = await ctx.db
        .insert(insurancePolicies)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          patientId: input.patientId,
          providerName: input.providerName,
          policyNumber: input.policyNumber ?? null,
          groupNumber: input.groupNumber ?? null,
          phoneNumber: input.phoneNumber ?? null,
          coverageType: input.coverageType ?? null,
          deductible: input.deductible ?? null,
          coveragePercent: input.coveragePercent ?? null,
          maxAnnualBenefit: input.maxAnnualBenefit ?? null,
          effectiveDate: input.effectiveDate ?? null,
          expirationDate: input.expirationDate ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      return policy!;
    }),

  updatePolicy: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        providerName: z.string().min(1).max(255).optional(),
        policyNumber: z.string().max(128).optional(),
        groupNumber: z.string().max(128).optional(),
        phoneNumber: z.string().max(32).optional(),
        coverageType: z.string().max(128).optional(),
        deductible: z.string().optional(),
        coveragePercent: z.number().min(0).max(100).optional(),
        maxAnnualBenefit: z.string().optional(),
        effectiveDate: z.string().optional(),
        expirationDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Filter out undefined values
      const setValues: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setValues[key] = value;
        }
      }

      const [policy] = await ctx.db
        .update(insurancePolicies)
        .set(setValues)
        .where(
          and(
            eq(insurancePolicies.id, id),
            eq(insurancePolicies.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!policy) throw new Error("Policy not found");
      return policy;
    }),

  listClaims: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        policyId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(insuranceClaims.practiceId, ctx.practiceId),
        isNull(insuranceClaims.deletedAt),
      ];

      if (input.status) {
        conditions.push(eq(insuranceClaims.status, input.status as any));
      }

      if (input.policyId) {
        conditions.push(eq(insuranceClaims.policyId, input.policyId));
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: insuranceClaims.id,
            claimNumber: insuranceClaims.claimNumber,
            status: insuranceClaims.status,
            claimAmount: insuranceClaims.claimAmount,
            approvedAmount: insuranceClaims.approvedAmount,
            deniedReason: insuranceClaims.deniedReason,
            submittedAt: insuranceClaims.submittedAt,
            resolvedAt: insuranceClaims.resolvedAt,
            notes: insuranceClaims.notes,
            createdAt: insuranceClaims.createdAt,
            providerName: insurancePolicies.providerName,
            policyNumber: insurancePolicies.policyNumber,
          })
          .from(insuranceClaims)
          .leftJoin(
            insurancePolicies,
            eq(insuranceClaims.policyId, insurancePolicies.id)
          )
          .where(and(...conditions))
          .orderBy(desc(insuranceClaims.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(insuranceClaims)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  createClaim: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        policyId: z.string().uuid(),
        invoiceId: z.string().uuid().optional(),
        claimNumber: z.string().max(128).optional(),
        claimAmount: z.string().refine(
          (v) => parseFloat(v) > 0,
          "Claim amount must be positive"
        ),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [claim] = await ctx.db
        .insert(insuranceClaims)
        .values({
          practiceId: ctx.practiceId,
          policyId: input.policyId,
          invoiceId: input.invoiceId ?? null,
          claimNumber: input.claimNumber ?? null,
          claimAmount: input.claimAmount,
          status: "draft",
          notes: input.notes ?? null,
        })
        .returning();
      return claim!;
    }),

  updateClaimStatus: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "draft",
          "submitted",
          "in_review",
          "approved",
          "denied",
          "paid",
        ]),
        approvedAmount: z.string().optional(),
        deniedReason: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, any> = { status: input.status };

      // Auto-set submittedAt when status moves to "submitted"
      if (input.status === "submitted") {
        updates.submittedAt = new Date();
      }

      // Auto-set resolvedAt when claim reaches a terminal status
      if (["approved", "denied", "paid"].includes(input.status)) {
        updates.resolvedAt = new Date();
      }

      if (input.approvedAmount !== undefined) {
        updates.approvedAmount = input.approvedAmount;
      }

      if (input.deniedReason !== undefined) {
        updates.deniedReason = input.deniedReason;
      }

      if (input.notes !== undefined) {
        updates.notes = input.notes;
      }

      const [claim] = await ctx.db
        .update(insuranceClaims)
        .set(updates)
        .where(
          and(
            eq(insuranceClaims.id, input.id),
            eq(insuranceClaims.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (!claim) throw new Error("Claim not found");
      return claim;
    }),
});
