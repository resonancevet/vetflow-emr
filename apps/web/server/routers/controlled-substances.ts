import { z } from "zod";
import { eq, and, isNull, gte, lte, sql, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  controlledSubstanceLog,
  patients,
  users,
} from "@openpims/db";
import { alias } from "drizzle-orm/pg-core";

export const controlledSubstancesRouter = createRouter({
  list: protectedProcedure
    .input(
      z.object({
        drugName: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const performer = alias(users, "performer");
      const witness = alias(users, "witness");

      const conditions: ReturnType<typeof eq>[] = [
        eq(controlledSubstanceLog.practiceId, ctx.practiceId),
        isNull(controlledSubstanceLog.deletedAt),
      ];

      if (input.drugName) {
        conditions.push(
          eq(controlledSubstanceLog.drugName, input.drugName)
        );
      }
      if (input.startDate) {
        conditions.push(
          gte(
            controlledSubstanceLog.performedAt,
            new Date(input.startDate)
          )
        );
      }
      if (input.endDate) {
        conditions.push(
          lte(
            controlledSubstanceLog.performedAt,
            new Date(input.endDate)
          )
        );
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: controlledSubstanceLog.id,
            drugName: controlledSubstanceLog.drugName,
            deaSchedule: controlledSubstanceLog.deaSchedule,
            action: controlledSubstanceLog.action,
            quantity: controlledSubstanceLog.quantity,
            unit: controlledSubstanceLog.unit,
            lotNumber: controlledSubstanceLog.lotNumber,
            notes: controlledSubstanceLog.notes,
            performedAt: controlledSubstanceLog.performedAt,
            patientId: controlledSubstanceLog.patientId,
            patientName: patients.name,
            performerName: performer.name,
            witnessName: witness.name,
          })
          .from(controlledSubstanceLog)
          .leftJoin(
            patients,
            eq(controlledSubstanceLog.patientId, patients.id)
          )
          .leftJoin(
            performer,
            eq(controlledSubstanceLog.performedBy, performer.id)
          )
          .leftJoin(
            witness,
            eq(controlledSubstanceLog.witnessedBy, witness.id)
          )
          .where(and(...conditions))
          .orderBy(desc(controlledSubstanceLog.performedAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(controlledSubstanceLog)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  create: protectedProcedure
    .use(requireRole("admin", "veterinarian"))
    .input(
      z.object({
        drugName: z.string().min(1),
        deaSchedule: z.enum(["II", "III", "IV", "V"]),
        action: z.enum(["received", "administered", "wasted", "returned"]),
        quantity: z.string(),
        unit: z.string().min(1),
        patientId: z.string().uuid().nullable().optional(),
        witnessedBy: z.string().uuid().nullable().optional(),
        lotNumber: z.string().optional(),
        notes: z.string().optional(),
        performedAt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Waste requires a witness
      if (input.action === "wasted" && !input.witnessedBy) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Controlled substance waste requires a witness.",
        });
      }

      // Administered requires a patient
      if (input.action === "administered" && !input.patientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "A patient must be specified when administering a controlled substance.",
        });
      }

      const [entry] = await ctx.db
        .insert(controlledSubstanceLog)
        .values({
          practiceId: ctx.practiceId,
          drugName: input.drugName,
          deaSchedule: input.deaSchedule,
          action: input.action,
          quantity: input.quantity,
          unit: input.unit,
          patientId: input.patientId ?? null,
          performedBy: ctx.user.id,
          witnessedBy: input.witnessedBy ?? null,
          lotNumber: input.lotNumber,
          notes: input.notes,
          performedAt: input.performedAt
            ? new Date(input.performedAt)
            : new Date(),
        })
        .returning();

      return entry!;
    }),

  summary: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(controlledSubstanceLog.practiceId, ctx.practiceId),
        isNull(controlledSubstanceLog.deletedAt),
      ];

      if (input.startDate) {
        conditions.push(
          gte(
            controlledSubstanceLog.performedAt,
            new Date(input.startDate)
          )
        );
      }
      if (input.endDate) {
        conditions.push(
          lte(
            controlledSubstanceLog.performedAt,
            new Date(input.endDate)
          )
        );
      }

      const rows = await ctx.db
        .select({
          drugName: controlledSubstanceLog.drugName,
          unit: controlledSubstanceLog.unit,
          totalReceived: sql<string>`coalesce(sum(case when ${controlledSubstanceLog.action} = 'received' then ${controlledSubstanceLog.quantity} else 0 end), 0)`,
          totalAdministered: sql<string>`coalesce(sum(case when ${controlledSubstanceLog.action} = 'administered' then ${controlledSubstanceLog.quantity} else 0 end), 0)`,
          totalWasted: sql<string>`coalesce(sum(case when ${controlledSubstanceLog.action} = 'wasted' then ${controlledSubstanceLog.quantity} else 0 end), 0)`,
          totalReturned: sql<string>`coalesce(sum(case when ${controlledSubstanceLog.action} = 'returned' then ${controlledSubstanceLog.quantity} else 0 end), 0)`,
        })
        .from(controlledSubstanceLog)
        .where(and(...conditions))
        .groupBy(controlledSubstanceLog.drugName, controlledSubstanceLog.unit)
        .orderBy(controlledSubstanceLog.drugName);

      return rows;
    }),
});
