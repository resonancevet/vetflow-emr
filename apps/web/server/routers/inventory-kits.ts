import { z } from "zod";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  inventoryKits,
  inventoryKitItems,
  products,
  services,
} from "@openpims/db";
import { DUE_INTERVAL_UNITS } from "@/lib/due-interval";
import { KIT_KINDS } from "@/lib/kit-kind";

const dueIntervalUnitSchema = z.enum(DUE_INTERVAL_UNITS);

const dueIntervalFields = {
  dueIntervalValue: z.number().int().min(1).max(3650).nullable().optional(),
  dueIntervalUnit: dueIntervalUnitSchema.nullable().optional(),
  planName: z.string().max(255).nullable().optional(),
  kind: z.enum(KIT_KINDS).optional(),
};

const itemInput = z
  .object({
    itemType: z.enum(["product", "service"]).default("product"),
    productId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).default(1),
    sortOrder: z.number().int().min(0).default(0),
    note: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.itemType === "product" && !item.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Product is required for inventory kit lines",
        path: ["productId"],
      });
    }
    if (item.itemType === "service" && !item.serviceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Service is required for fee kit lines",
        path: ["serviceId"],
      });
    }
  });

const kitItemSelect = {
  id: inventoryKitItems.id,
  kitId: inventoryKitItems.kitId,
  itemType: inventoryKitItems.itemType,
  productId: inventoryKitItems.productId,
  serviceId: inventoryKitItems.serviceId,
  quantity: inventoryKitItems.quantity,
  sortOrder: inventoryKitItems.sortOrder,
  note: inventoryKitItems.note,
  productName: products.name,
  productPlanName: products.planName,
  productSku: products.sku,
  productLotNumber: products.lotNumber,
  stockQuantity: products.stockQuantity,
  units: products.units,
  category: products.category,
  unitPrice: products.unitPrice,
  costPrice: products.costPrice,
  serviceName: services.name,
  serviceCategory: services.category,
  serviceDefaultPrice: services.defaultPrice,
};

async function loadKit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  kitId: string
) {
  const [kit] = await db
    .select()
    .from(inventoryKits)
    .where(
      and(
        eq(inventoryKits.id, kitId),
        eq(inventoryKits.practiceId, practiceId),
        isNull(inventoryKits.deletedAt)
      )
    )
    .limit(1);

  if (!kit) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Inventory kit not found",
    });
  }

  const items = await db
    .select(kitItemSelect)
    .from(inventoryKitItems)
    .leftJoin(products, eq(inventoryKitItems.productId, products.id))
    .leftJoin(services, eq(inventoryKitItems.serviceId, services.id))
    .where(
      and(
        eq(inventoryKitItems.kitId, kitId),
        isNull(inventoryKitItems.deletedAt)
      )
    )
    .orderBy(asc(inventoryKitItems.sortOrder));

  return { ...kit, items };
}

function mapKitItemRows(
  kitId: string,
  items: z.infer<typeof itemInput>[]
) {
  return items.map((item, index) => ({
    kitId,
    itemType: item.itemType,
    productId: item.itemType === "product" ? item.productId! : null,
    serviceId: item.itemType === "service" ? item.serviceId! : null,
    quantity: item.quantity,
    sortOrder: item.sortOrder ?? index,
    note: item.note || null,
  }));
}

export const inventoryKitsRouter = createRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const kits = await ctx.db
      .select()
      .from(inventoryKits)
      .where(
        and(
          eq(inventoryKits.practiceId, ctx.practiceId),
          isNull(inventoryKits.deletedAt)
        )
      )
      .orderBy(asc(inventoryKits.name));

    if (kits.length === 0) return [];

    const items = await ctx.db
      .select(kitItemSelect)
      .from(inventoryKitItems)
      .leftJoin(products, eq(inventoryKitItems.productId, products.id))
      .leftJoin(services, eq(inventoryKitItems.serviceId, services.id))
      .where(
        and(
          inArray(
            inventoryKitItems.kitId,
            kits.map((kit) => kit.id)
          ),
          isNull(inventoryKitItems.deletedAt)
        )
      )
      .orderBy(asc(inventoryKitItems.sortOrder));

    return kits.map((kit) => ({
      ...kit,
      items: items.filter((item) => item.kitId === kit.id),
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return loadKit(ctx.db, ctx.practiceId, input.id);
    }),

  create: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        name: z.string().min(1).max(255),
        items: z.array(itemInput).min(1),
        ...dueIntervalFields,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [kit] = await ctx.db
        .insert(inventoryKits)
        .values({
          practiceId: ctx.practiceId,
          name: input.name,
          dueIntervalValue: input.dueIntervalValue ?? null,
          dueIntervalUnit: input.dueIntervalUnit ?? null,
          planName: input.planName?.trim() || null,
          kind: input.kind ?? "vaccine",
        })
        .returning();

      await ctx.db
        .insert(inventoryKitItems)
        .values(mapKitItemRows(kit!.id, input.items));

      return loadKit(ctx.db, ctx.practiceId, kit!.id);
    }),

  update: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        isActive: z.boolean().optional(),
        items: z.array(itemInput).min(1).optional(),
        ...dueIntervalFields,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...fields } = input;

      const [existing] = await ctx.db
        .select({ id: inventoryKits.id })
        .from(inventoryKits)
        .where(
          and(
            eq(inventoryKits.id, id),
            eq(inventoryKits.practiceId, ctx.practiceId),
            isNull(inventoryKits.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory kit not found",
        });
      }

      const updateValues: Record<string, unknown> = {};
      if (fields.name !== undefined) updateValues.name = fields.name;
      if (fields.isActive !== undefined) updateValues.isActive = fields.isActive;
      if (fields.dueIntervalValue !== undefined) {
        updateValues.dueIntervalValue = fields.dueIntervalValue;
      }
      if (fields.dueIntervalUnit !== undefined) {
        updateValues.dueIntervalUnit = fields.dueIntervalUnit;
      }
      if (fields.planName !== undefined) {
        updateValues.planName = fields.planName?.trim() || null;
      }
      if (fields.kind !== undefined) updateValues.kind = fields.kind;

      if (Object.keys(updateValues).length > 0) {
        await ctx.db
          .update(inventoryKits)
          .set(updateValues)
          .where(
            and(
              eq(inventoryKits.id, id),
              eq(inventoryKits.practiceId, ctx.practiceId)
            )
          );
      }

      if (items) {
        await ctx.db
          .update(inventoryKitItems)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(inventoryKitItems.kitId, id),
              isNull(inventoryKitItems.deletedAt)
            )
          );

        await ctx.db
          .insert(inventoryKitItems)
          .values(mapKitItemRows(id, items));
      }

      return loadKit(ctx.db, ctx.practiceId, id);
    }),

  delete: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [kit] = await ctx.db
        .update(inventoryKits)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(inventoryKits.id, input.id),
            eq(inventoryKits.practiceId, ctx.practiceId),
            isNull(inventoryKits.deletedAt)
          )
        )
        .returning();

      if (!kit) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory kit not found",
        });
      }

      await ctx.db
        .update(inventoryKitItems)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(inventoryKitItems.kitId, input.id),
            isNull(inventoryKitItems.deletedAt)
          )
        );

      return kit;
    }),
});
