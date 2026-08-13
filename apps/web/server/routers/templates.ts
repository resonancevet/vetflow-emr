import { z } from "zod";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  treatmentTemplates,
  treatmentTemplateItems,
  invoices,
  invoiceItems,
  practices,
  inventoryKits,
  inventoryKitItems,
  products,
} from "@openpims/db";
import { calcTax, getEffectiveTaxRatePercent } from "@/lib/tax";
import {
  expandTemplateItems,
  type KitForTemplate,
} from "@/lib/treatment-template";

const templateItemTypeSchema = z.enum(["service", "product", "kit"]);

async function loadKitsForTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  kitIds: string[]
): Promise<KitForTemplate[]> {
  const uniqueIds = [...new Set(kitIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const kits = await db
    .select()
    .from(inventoryKits)
    .where(
      and(
        eq(inventoryKits.practiceId, practiceId),
        inArray(inventoryKits.id, uniqueIds),
        isNull(inventoryKits.deletedAt)
      )
    );

  if (kits.length === 0) return [];

  const items = await db
    .select({
      kitId: inventoryKitItems.kitId,
      productId: inventoryKitItems.productId,
      quantity: inventoryKitItems.quantity,
      productName: products.name,
      productPlanName: products.planName,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
    })
    .from(inventoryKitItems)
    .innerJoin(products, eq(inventoryKitItems.productId, products.id))
    .where(
      and(
        inArray(
          inventoryKitItems.kitId,
          kits.map((kit: { id: string }) => kit.id)
        ),
        isNull(inventoryKitItems.deletedAt),
        isNull(products.deletedAt)
      )
    );

  return kits.map((kit: { id: string; name: string; planName: string | null }) => ({
    ...kit,
    items: items.filter((item: { kitId: string }) => item.kitId === kit.id),
  }));
}

export const templatesRouter = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(treatmentTemplates)
      .where(
        and(
          eq(treatmentTemplates.practiceId, ctx.practiceId),
          isNull(treatmentTemplates.deletedAt)
        )
      )
      .orderBy(asc(treatmentTemplates.name));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [template] = await ctx.db
        .select()
        .from(treatmentTemplates)
        .where(
          and(
            eq(treatmentTemplates.id, input.id),
            eq(treatmentTemplates.practiceId, ctx.practiceId),
            isNull(treatmentTemplates.deletedAt)
          )
        )
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Treatment template not found",
        });
      }

      const items = await ctx.db
        .select()
        .from(treatmentTemplateItems)
        .where(
          and(
            eq(treatmentTemplateItems.templateId, input.id),
            isNull(treatmentTemplateItems.deletedAt)
          )
        )
        .orderBy(asc(treatmentTemplateItems.sortOrder));

      return { ...template, items };
    }),

  create: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.string().max(128).optional(),
        items: z.array(
          z.object({
            itemType: templateItemTypeSchema,
            itemId: z.string().uuid().optional(),
            description: z.string().min(1).max(500),
            defaultQuantity: z.number().int().min(1).default(1),
            defaultUnitPrice: z.string().refine(
              (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
              "Must be a valid non-negative number"
            ),
            sortOrder: z.number().int().min(0).default(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [template] = await ctx.db
        .insert(treatmentTemplates)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
        })
        .returning();

      if (input.items.length > 0) {
        await ctx.db.insert(treatmentTemplateItems).values(
          input.items.map((item) => ({
            templateId: template!.id,
            itemType: item.itemType,
            itemId: item.itemId ?? null,
            description: item.description,
            defaultQuantity: item.defaultQuantity,
            defaultUnitPrice: item.defaultUnitPrice,
            sortOrder: item.sortOrder,
          }))
        );
      }

      return template!;
    }),

  update: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        category: z.string().max(128).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [template] = await ctx.db
        .update(treatmentTemplates)
        .set(updates)
        .where(
          and(
            eq(treatmentTemplates.id, id),
            eq(treatmentTemplates.practiceId, ctx.practiceId),
            isNull(treatmentTemplates.deletedAt)
          )
        )
        .returning();

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Treatment template not found",
        });
      }

      return template;
    }),

  delete: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [template] = await ctx.db
        .update(treatmentTemplates)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(treatmentTemplates.id, input.id),
            eq(treatmentTemplates.practiceId, ctx.practiceId),
            isNull(treatmentTemplates.deletedAt)
          )
        )
        .returning();

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Treatment template not found",
        });
      }

      return template;
    }),

  addItem: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        templateId: z.string().uuid(),
        itemType: templateItemTypeSchema,
        itemId: z.string().uuid().optional(),
        description: z.string().min(1).max(500),
        defaultQuantity: z.number().int().min(1).default(1),
        defaultUnitPrice: z.string().refine(
          (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
          "Must be a valid non-negative number"
        ),
        sortOrder: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the template belongs to this practice
      const [template] = await ctx.db
        .select({ id: treatmentTemplates.id })
        .from(treatmentTemplates)
        .where(
          and(
            eq(treatmentTemplates.id, input.templateId),
            eq(treatmentTemplates.practiceId, ctx.practiceId),
            isNull(treatmentTemplates.deletedAt)
          )
        )
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Treatment template not found",
        });
      }

      const [item] = await ctx.db
        .insert(treatmentTemplateItems)
        .values({
          templateId: input.templateId,
          itemType: input.itemType,
          itemId: input.itemId ?? null,
          description: input.description,
          defaultQuantity: input.defaultQuantity,
          defaultUnitPrice: input.defaultUnitPrice,
          sortOrder: input.sortOrder,
        })
        .returning();

      return item!;
    }),

  removeItem: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify item belongs to a template owned by this practice
      const itemRows = await ctx.db
        .select({
          itemId: treatmentTemplateItems.id,
          practiceId: treatmentTemplates.practiceId,
        })
        .from(treatmentTemplateItems)
        .innerJoin(
          treatmentTemplates,
          eq(treatmentTemplateItems.templateId, treatmentTemplates.id)
        )
        .where(
          and(
            eq(treatmentTemplateItems.id, input.id),
            isNull(treatmentTemplateItems.deletedAt)
          )
        )
        .limit(1);

      if (!itemRows.length || itemRows[0]!.practiceId !== ctx.practiceId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template item not found",
        });
      }

      const [removed] = await ctx.db
        .update(treatmentTemplateItems)
        .set({ deletedAt: new Date() })
        .where(eq(treatmentTemplateItems.id, input.id))
        .returning();

      return removed!;
    }),

  applyToInvoice: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        templateId: z.string().uuid(),
        invoiceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify template belongs to this practice
      const [template] = await ctx.db
        .select({ id: treatmentTemplates.id })
        .from(treatmentTemplates)
        .where(
          and(
            eq(treatmentTemplates.id, input.templateId),
            eq(treatmentTemplates.practiceId, ctx.practiceId),
            isNull(treatmentTemplates.deletedAt),
            eq(treatmentTemplates.isActive, true)
          )
        )
        .limit(1);

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Treatment template not found",
        });
      }

      // Verify invoice belongs to this practice
      const [invoice] = await ctx.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt)
          )
        )
        .limit(1);

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      // Fetch template items
      const items = await ctx.db
        .select()
        .from(treatmentTemplateItems)
        .where(
          and(
            eq(treatmentTemplateItems.templateId, input.templateId),
            isNull(treatmentTemplateItems.deletedAt)
          )
        )
        .orderBy(asc(treatmentTemplateItems.sortOrder));

      if (items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Template has no items",
        });
      }

      const kits = await loadKitsForTemplate(
        ctx.db,
        ctx.practiceId,
        items
          .filter((item) => item.itemType === "kit" && item.itemId)
          .map((item) => item.itemId!)
      );
      const invoiceLines = expandTemplateItems(items, kits);

      await ctx.db.insert(invoiceItems).values(
        invoiceLines.map((item) => ({
          invoiceId: input.invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: (item.quantity * parseFloat(item.unitPrice)).toFixed(2),
          itemType: item.itemType,
          itemId: item.itemId ?? null,
        }))
      );

      // Recalculate invoice totals (fetch ALL items for this invoice)
      const allItems = await ctx.db
        .select({
          quantity: invoiceItems.quantity,
          unitPrice: invoiceItems.unitPrice,
        })
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, input.invoiceId));

      const subtotal = allItems.reduce((sum, row) => {
        return sum + row.quantity * parseFloat(row.unitPrice);
      }, 0);

      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const tax = calcTax(
        subtotal,
        getEffectiveTaxRatePercent(practice?.settings)
      );
      const total = Math.round((subtotal + tax) * 100) / 100;

      const [updatedInvoice] = await ctx.db
        .update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
        })
        .where(eq(invoices.id, input.invoiceId))
        .returning();

      return updatedInvoice!;
    }),
});
