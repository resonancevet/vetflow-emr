import { z } from "zod";
import { eq, and, isNull, ilike, sql } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import { products, suppliers } from "@openpims/db";

export const inventoryRouter = createRouter({
  // --- Products ---

  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(products.practiceId, ctx.practiceId),
        isNull(products.deletedAt),
      ];

      if (input.search) {
        conditions.push(
          sql`(${ilike(products.name, `%${input.search}%`)} OR ${ilike(products.sku, `%${input.search}%`)})`
        );
      }

      if (input.category) {
        conditions.push(eq(products.category, input.category));
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select()
          .from(products)
          .where(and(...conditions))
          .orderBy(products.name)
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(and(...conditions)),
      ]);

      return {
        items: items.map((p) => ({
          ...p,
          stockStatus:
            p.stockQuantity <= (p.reorderPoint ?? 10) ? "low" : "ok",
        })),
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        sku: z.string().max(64).optional(),
        category: z.string().max(128).optional(),
        unitPrice: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Must be a valid price"),
        costPrice: z.string().optional(),
        stockQuantity: z.number().int().min(0).default(0),
        reorderPoint: z.number().int().min(0).default(10),
        lotNumber: z.string().max(64).optional(),
        expirationDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .insert(products)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          sku: input.sku ?? null,
          category: input.category ?? null,
          unitPrice: input.unitPrice,
          costPrice: input.costPrice ?? null,
          stockQuantity: input.stockQuantity,
          reorderPoint: input.reorderPoint,
          lotNumber: input.lotNumber ?? null,
          expirationDate: input.expirationDate ?? null,
        })
        .returning();
      return product!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        sku: z.string().max(64).optional(),
        category: z.string().max(128).optional(),
        unitPrice: z.string().optional(),
        costPrice: z.string().optional(),
        stockQuantity: z.number().int().min(0).optional(),
        reorderPoint: z.number().int().min(0).optional(),
        lotNumber: z.string().max(64).optional(),
        expirationDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      // Filter out undefined values
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setValues[key] = value;
        }
      }

      if (Object.keys(setValues).length === 0) {
        throw new Error("No fields to update");
      }

      const [product] = await ctx.db
        .update(products)
        .set(setValues)
        .where(
          and(
            eq(products.id, id),
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        )
        .returning();

      if (!product) throw new Error("Product not found");
      return product;
    }),

  adjustStock: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        adjustment: z.number().int(),
        reason: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} + ${input.adjustment}`,
        })
        .where(
          and(
            eq(products.id, input.id),
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        )
        .returning();

      if (!product) throw new Error("Product not found");
      return product;
    }),

  // --- Suppliers ---

  listSuppliers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.practiceId, ctx.practiceId),
          isNull(suppliers.deletedAt)
        )
      )
      .orderBy(suppliers.name);
  }),

  createSupplier: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        contactEmail: z.string().email().max(255).optional(),
        phone: z.string().max(32).optional(),
        address: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [supplier] = await ctx.db
        .insert(suppliers)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          contactEmail: input.contactEmail ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      return supplier!;
    }),
});
