import { z } from "zod";
import { eq, and, isNull, ilike, sql, desc, asc, inArray } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import {
  products,
  suppliers,
  inventoryOrders,
  inventoryOrderItems,
} from "@openpims/db";
import {
  normalizePrice,
  calcCostPerCount,
  calcLineTotal,
  todayDateString,
} from "@/lib/inventory-price";

const categoryEnum = z.enum([
  "medication",
  "vaccine",
  "preventive",
  "supplement",
  "food",
  "supply",
]);

const unitsEnum = z.enum(["doses", "tablets", "capsules", "L", "mL", "oz"]);

function totalsMismatch(
  unitPrice: string,
  quantity: number,
  csvTotal: string | null | undefined
): boolean {
  if (!csvTotal) return false;
  const calc = parseFloat(calcLineTotal(unitPrice, quantity));
  const csv = parseFloat(csvTotal);
  if (isNaN(calc) || isNaN(csv)) return false;
  return Math.abs(calc - csv) > 0.009;
}

async function resolveSupplier(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  supplierName: string | null | undefined
): Promise<{ supplierId: string | null; supplierName: string | null }> {
  const name = supplierName?.trim() || null;
  if (!name) return { supplierId: null, supplierName: null };

  const [existing] = await db
    .select()
    .from(suppliers)
    .where(
      and(
        eq(suppliers.practiceId, practiceId),
        isNull(suppliers.deletedAt),
        ilike(suppliers.name, name)
      )
    )
    .limit(1);

  if (existing) {
    return { supplierId: existing.id, supplierName: existing.name };
  }

  const [created] = await db
    .insert(suppliers)
    .values({ practiceId, name })
    .returning();

  return { supplierId: created!.id, supplierName: created!.name };
}

async function syncProductFromReceive(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: any; practiceId: string },
  item: typeof inventoryOrderItems.$inferSelect,
  order: typeof inventoryOrders.$inferSelect
) {
  if (
    !item.isReceived ||
    !item.category ||
    !item.qtyReceived ||
    !item.count ||
    !item.units
  ) {
    return item;
  }

  const stockDeltaTarget = item.qtyReceived * item.count;
  const cost =
    calcCostPerCount(item.unitPrice, item.quantity, item.count) ??
    item.costPerCount;

  let productId = item.productId;
  const prevPosted = item.stockPosted ?? 0;

  if (productId) {
    const [existing] = await ctx.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.practiceId, ctx.practiceId),
          isNull(products.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      const nextStock = Math.max(
        0,
        existing.stockQuantity - prevPosted + stockDeltaTarget
      );
      await ctx.db
        .update(products)
        .set({
          name: item.name,
          sku: item.sku,
          category: item.category,
          unitPrice: item.unitPrice,
          costPrice: cost,
          stockQuantity: nextStock,
          reorderPoint: item.reorderPoint ?? existing.reorderPoint,
          lotNumber: item.lotNumber ?? existing.lotNumber,
          expirationDate: item.expirationDate ?? existing.expirationDate,
          units: item.units,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          needsReview: false,
        })
        .where(eq(products.id, existing.id));
    } else {
      productId = null;
    }
  }

  if (!productId && item.sku) {
    const [bySku] = await ctx.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.practiceId, ctx.practiceId),
          isNull(products.deletedAt),
          eq(products.sku, item.sku)
        )
      )
      .limit(1);

    if (bySku) {
      productId = bySku.id;
      const nextStock = Math.max(
        0,
        bySku.stockQuantity - prevPosted + stockDeltaTarget
      );
      await ctx.db
        .update(products)
        .set({
          name: item.name,
          category: item.category,
          unitPrice: item.unitPrice,
          costPrice: cost,
          stockQuantity: nextStock,
          reorderPoint: item.reorderPoint ?? bySku.reorderPoint,
          lotNumber: item.lotNumber ?? bySku.lotNumber,
          expirationDate: item.expirationDate ?? bySku.expirationDate,
          units: item.units,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          needsReview: false,
        })
        .where(eq(products.id, bySku.id));
    }
  }

  if (!productId) {
    const [created] = await ctx.db
      .insert(products)
      .values({
        practiceId: ctx.practiceId,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unitPrice: item.unitPrice,
        costPrice: cost,
        stockQuantity: stockDeltaTarget,
        reorderPoint: item.reorderPoint ?? 10,
        lotNumber: item.lotNumber,
        expirationDate: item.expirationDate,
        units: item.units,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        needsReview: false,
      })
      .returning();
    productId = created!.id;
  }

  const [updated] = await ctx.db
    .update(inventoryOrderItems)
    .set({
      productId,
      stockPosted: stockDeltaTarget,
      costPerCount: cost,
    })
    .where(eq(inventoryOrderItems.id, item.id))
    .returning();

  return updated!;
}

async function reversePostedStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { db: any; practiceId: string },
  item: typeof inventoryOrderItems.$inferSelect
) {
  if (!item.productId || !item.stockPosted) return;

  const [existing] = await ctx.db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, item.productId),
        eq(products.practiceId, ctx.practiceId),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    await ctx.db
      .update(products)
      .set({
        stockQuantity: Math.max(0, existing.stockQuantity - item.stockPosted),
      })
      .where(eq(products.id, existing.id));
  }
}

function mapOrderWithItems(
  order: typeof inventoryOrders.$inferSelect,
  items: (typeof inventoryOrderItems.$inferSelect)[]
) {
  return {
    ...order,
    items: items.map((item) => ({
      ...item,
      calculatedTotal: calcLineTotal(item.unitPrice, item.quantity),
      lineComplete:
        item.isReceived &&
        !!item.category &&
        !!item.qtyReceived &&
        !!item.count &&
        !!item.units &&
        (item.qtyReceived ?? 0) >= item.quantity,
      linePartial:
        item.isReceived &&
        (item.qtyReceived ?? 0) > 0 &&
        (item.qtyReceived ?? 0) < item.quantity,
    })),
  };
}

export const inventoryRouter = createRouter({
  // --- Products (on-hand) ---

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
      const conditions = [
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

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        sku: z.string().max(64).nullable().optional(),
        category: z.string().max(128).nullable().optional(),
        supplierName: z.string().max(255).nullable().optional(),
        unitPrice: z.string().optional(),
        costPrice: z.string().nullable().optional(),
        stockQuantity: z.number().int().min(0).optional(),
        reorderPoint: z.number().int().min(0).optional(),
        lotNumber: z.string().max(64).nullable().optional(),
        expirationDate: z.string().nullable().optional(),
        units: z.string().max(32).nullable().optional(),
        needsReview: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, supplierName, ...rest } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) setValues[key] = value;
      }

      if (supplierName !== undefined) {
        const resolved = await resolveSupplier(
          ctx.db,
          ctx.practiceId,
          supplierName
        );
        setValues.supplierId = resolved.supplierId;
        setValues.supplierName = resolved.supplierName;
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

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [product] = await ctx.db
        .update(products)
        .set({ deletedAt: new Date() })
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

  // --- Orders ---

  listOrders: protectedProcedure
    .input(
      z.object({
        status: z.enum(["active", "archived"]).default("active"),
      })
    )
    .query(async ({ ctx, input }) => {
      const orders = await ctx.db
        .select()
        .from(inventoryOrders)
        .where(
          and(
            eq(inventoryOrders.practiceId, ctx.practiceId),
            eq(inventoryOrders.status, input.status),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .orderBy(
          input.status === "archived"
            ? desc(inventoryOrders.archivedAt)
            : desc(inventoryOrders.dateOrdered),
          desc(inventoryOrders.createdAt)
        );

      if (orders.length === 0) return [];

      const items = await ctx.db
        .select()
        .from(inventoryOrderItems)
        .where(
          and(
            inArray(
              inventoryOrderItems.orderId,
              orders.map((o) => o.id)
            ),
            isNull(inventoryOrderItems.deletedAt)
          )
        )
        .orderBy(
          asc(inventoryOrderItems.sortOrder),
          asc(inventoryOrderItems.createdAt),
          asc(inventoryOrderItems.id)
        );

      const byOrder = new Map<string, typeof items>();
      for (const item of items) {
        const list = byOrder.get(item.orderId) ?? [];
        list.push(item);
        byOrder.set(item.orderId, list);
      }

      return orders.map((order) =>
        mapOrderWithItems(order, byOrder.get(order.id) ?? [])
      );
    }),

  createOrder: protectedProcedure
    .input(
      z.object({
        supplierName: z.string().max(255).optional(),
        dateOrdered: z.string().optional(),
        importedFromCsv: z.boolean().optional(),
        items: z
          .array(
            z.object({
              name: z.string().min(1).max(255),
              sku: z.string().max(64).optional(),
              unitPrice: z.string(),
              quantity: z.number().int().min(1).default(1),
              csvTotalPrice: z.string().optional(),
              dateOrdered: z.string().optional(),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const dateOrdered = input.dateOrdered || todayDateString();
      const resolved = await resolveSupplier(
        ctx.db,
        ctx.practiceId,
        input.supplierName
      );

      const [order] = await ctx.db
        .insert(inventoryOrders)
        .values({
          practiceId: ctx.practiceId,
          supplierId: resolved.supplierId,
          supplierName: resolved.supplierName,
          dateOrdered,
          status: "active",
          completionStatus: "not_received",
          importedFromCsv: input.importedFromCsv ?? false,
        })
        .returning();

      const itemRows = input.items.map((item, index) => {
        // Prefer cents-aware normalize when value has no decimal; otherwise dollars
        const unitPrice =
          item.unitPrice.includes(".") || item.unitPrice.includes(",")
            ? (() => {
                const n = parseFloat(
                  item.unitPrice.replace(/[$,\s]/g, "").replace(",", ".")
                );
                return isNaN(n) ? item.unitPrice : n.toFixed(2);
              })()
            : normalizePrice(item.unitPrice) ??
              parseFloat(item.unitPrice).toFixed(2);
        const csvTotal = item.csvTotalPrice
          ? item.csvTotalPrice.includes(".") ||
            item.csvTotalPrice.includes(",")
            ? (() => {
                const n = parseFloat(
                  item.csvTotalPrice.replace(/[$,\s]/g, "").replace(",", ".")
                );
                return isNaN(n) ? item.csvTotalPrice : n.toFixed(2);
              })()
            : normalizePrice(item.csvTotalPrice)
          : null;
        return {
          orderId: order!.id,
          name: item.name,
          sku: item.sku || null,
          unitPrice,
          quantity: item.quantity,
          sortOrder: index,
          csvTotalPrice: csvTotal,
          totalMismatch: totalsMismatch(unitPrice, item.quantity, csvTotal),
          dateOrdered: item.dateOrdered || dateOrdered,
        };
      });

      const items = await ctx.db
        .insert(inventoryOrderItems)
        .values(itemRows)
        .returning();

      return mapOrderWithItems(order!, items);
    }),

  addOrderItem: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        name: z.string().min(1).max(255),
        sku: z.string().max(64).optional(),
        unitPrice: z.string(),
        quantity: z.number().int().min(1).default(1),
        dateOrdered: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(inventoryOrders)
        .where(
          and(
            eq(inventoryOrders.id, input.orderId),
            eq(inventoryOrders.practiceId, ctx.practiceId),
            eq(inventoryOrders.status, "active"),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .limit(1);

      if (!order) throw new Error("Order not found");

      const n = parseFloat(input.unitPrice.replace(/[$,\s]/g, ""));
      const unitPrice = isNaN(n) ? input.unitPrice : n.toFixed(2);

      const [maxRow] = await ctx.db
        .select({
          maxSort: sql<number>`coalesce(max(${inventoryOrderItems.sortOrder}), -1)`,
        })
        .from(inventoryOrderItems)
        .where(
          and(
            eq(inventoryOrderItems.orderId, order.id),
            isNull(inventoryOrderItems.deletedAt)
          )
        );

      const [item] = await ctx.db
        .insert(inventoryOrderItems)
        .values({
          orderId: order.id,
          name: input.name,
          sku: input.sku || null,
          unitPrice,
          quantity: input.quantity,
          sortOrder: Number(maxRow?.maxSort ?? -1) + 1,
          dateOrdered: input.dateOrdered || order.dateOrdered,
        })
        .returning();

      return item!;
    }),

  updateOrder: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        supplierName: z.string().max(255).nullable().optional(),
        dateOrdered: z.string().optional(),
        dateReceived: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, supplierName, ...rest } = input;
      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) setValues[key] = value;
      }

      if (supplierName !== undefined) {
        const resolved = await resolveSupplier(
          ctx.db,
          ctx.practiceId,
          supplierName
        );
        setValues.supplierId = resolved.supplierId;
        setValues.supplierName = resolved.supplierName;
      }

      const [order] = await ctx.db
        .update(inventoryOrders)
        .set(setValues)
        .where(
          and(
            eq(inventoryOrders.id, id),
            eq(inventoryOrders.practiceId, ctx.practiceId),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .returning();

      if (!order) throw new Error("Order not found");

      // Keep line-item order dates in sync with the order header date
      if (input.dateOrdered) {
        await ctx.db
          .update(inventoryOrderItems)
          .set({ dateOrdered: input.dateOrdered })
          .where(
            and(
              eq(inventoryOrderItems.orderId, id),
              isNull(inventoryOrderItems.deletedAt)
            )
          );
      }

      return order;
    }),

  updateOrderItem: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        sku: z.string().max(64).nullable().optional(),
        unitPrice: z.string().optional(),
        quantity: z.number().int().min(1).optional(),
        dateOrdered: z.string().optional(),
        isReceived: z.boolean().optional(),
        dateReceived: z.string().nullable().optional(),
        category: categoryEnum.nullable().optional(),
        qtyReceived: z.number().int().min(0).nullable().optional(),
        count: z.number().int().min(0).nullable().optional(),
        units: unitsEnum.nullable().optional(),
        reorderPoint: z.number().int().min(0).nullable().optional(),
        lotNumber: z.string().max(64).nullable().optional(),
        expirationDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select()
        .from(inventoryOrderItems)
        .where(
          and(
            eq(inventoryOrderItems.id, id),
            isNull(inventoryOrderItems.deletedAt)
          )
        )
        .limit(1);

      if (!existing) throw new Error("Order item not found");

      const [order] = await ctx.db
        .select()
        .from(inventoryOrders)
        .where(
          and(
            eq(inventoryOrders.id, existing.orderId),
            eq(inventoryOrders.practiceId, ctx.practiceId),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .limit(1);

      if (!order) throw new Error("Order not found");
      if (order.status !== "active") {
        throw new Error("Cannot edit archived order");
      }

      // Clear receive data when unchecking Received
      if (updates.isReceived === false && existing.isReceived) {
        await reversePostedStock(ctx, existing);
        const [cleared] = await ctx.db
          .update(inventoryOrderItems)
          .set({
            isReceived: false,
            dateReceived: null,
            category: null,
            qtyReceived: null,
            count: null,
            units: null,
            costPerCount: null,
            reorderPoint: null,
            lotNumber: null,
            expirationDate: null,
            productId: null,
            stockPosted: 0,
          })
          .where(eq(inventoryOrderItems.id, id))
          .returning();
        return {
          ...cleared!,
          calculatedTotal: calcLineTotal(
            cleared!.unitPrice,
            cleared!.quantity
          ),
        };
      }

      const setValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value;
      }

      if (updates.unitPrice !== undefined) {
        // Edits are dollar amounts (cents conversion only applies on CSV import)
        const n = parseFloat(updates.unitPrice.replace(/[$,\s]/g, ""));
        setValues.unitPrice = isNaN(n)
          ? updates.unitPrice
          : n.toFixed(2);
      }

      if (updates.isReceived === true && !existing.isReceived) {
        setValues.dateReceived =
          updates.dateReceived ?? existing.dateReceived ?? todayDateString();
        setValues.qtyReceived =
          updates.qtyReceived ?? existing.qtyReceived ?? existing.quantity;
      }

      const unitPrice = String(
        setValues.unitPrice ?? existing.unitPrice
      );
      const quantity = Number(setValues.quantity ?? existing.quantity);
      setValues.totalMismatch = totalsMismatch(
        unitPrice,
        quantity,
        existing.csvTotalPrice
      );

      const count = Number(setValues.count ?? existing.count ?? 0);
      if (count > 0) {
        setValues.costPerCount = calcCostPerCount(unitPrice, quantity, count);
      }

      const [updated] = await ctx.db
        .update(inventoryOrderItems)
        .set(setValues)
        .where(eq(inventoryOrderItems.id, id))
        .returning();

      const synced = await syncProductFromReceive(ctx, updated!, order);

      return {
        ...synced,
        calculatedTotal: calcLineTotal(synced.unitPrice, synced.quantity),
      };
    }),

  deleteOrderItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(inventoryOrderItems)
        .where(
          and(
            eq(inventoryOrderItems.id, input.id),
            isNull(inventoryOrderItems.deletedAt)
          )
        )
        .limit(1);

      if (!existing) throw new Error("Order item not found");

      const [order] = await ctx.db
        .select()
        .from(inventoryOrders)
        .where(
          and(
            eq(inventoryOrders.id, existing.orderId),
            eq(inventoryOrders.practiceId, ctx.practiceId),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .limit(1);

      if (!order) throw new Error("Order not found");
      if (order.status !== "active") {
        throw new Error("Cannot edit archived order");
      }

      await reversePostedStock(ctx, existing);

      await ctx.db
        .update(inventoryOrderItems)
        .set({ deletedAt: new Date(), stockPosted: 0, productId: null })
        .where(eq(inventoryOrderItems.id, input.id));

      return { ok: true };
    }),

  completeOrder: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        forceIncomplete: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [order] = await ctx.db
        .select()
        .from(inventoryOrders)
        .where(
          and(
            eq(inventoryOrders.id, input.id),
            eq(inventoryOrders.practiceId, ctx.practiceId),
            eq(inventoryOrders.status, "active"),
            isNull(inventoryOrders.deletedAt)
          )
        )
        .limit(1);

      if (!order) throw new Error("Order not found");

      const items = await ctx.db
        .select()
        .from(inventoryOrderItems)
        .where(
          and(
            eq(inventoryOrderItems.orderId, order.id),
            isNull(inventoryOrderItems.deletedAt)
          )
        );

      const incompleteFields: {
        itemId: string;
        name: string;
        missing: string[];
      }[] = [];

      for (const item of items) {
        if (!item.isReceived) continue;
        const missing: string[] = [];
        if (!item.dateReceived) missing.push("Date Received");
        if (!item.category) missing.push("Category");
        if (!item.qtyReceived && item.qtyReceived !== 0) {
          missing.push("Qty Received");
        }
        if (!item.count) missing.push("Count");
        if (!item.units) missing.push("Units");
        if (missing.length) {
          incompleteFields.push({
            itemId: item.id,
            name: item.name,
            missing,
          });
        }
      }

      if (incompleteFields.length > 0) {
        return {
          ok: false as const,
          incompleteFields,
        };
      }

      const anyReceived = items.some((i) => i.isReceived);
      const allFullyReceived =
        items.length > 0 &&
        items.every(
          (i) =>
            i.isReceived &&
            (i.qtyReceived ?? 0) >= i.quantity &&
            !!i.category &&
            !!i.count &&
            !!i.units
        );
      const somePartial = items.some(
        (i) =>
          i.isReceived &&
          (i.qtyReceived ?? 0) > 0 &&
          (i.qtyReceived ?? 0) < i.quantity
      );
      const someUnreceived = items.some((i) => !i.isReceived);

      if (
        (somePartial || someUnreceived) &&
        anyReceived &&
        !allFullyReceived &&
        !input.forceIncomplete
      ) {
        return {
          ok: false as const,
          needsConfirmIncomplete: true as const,
          incompleteFields: [],
        };
      }

      let completionStatus: "complete" | "incomplete" | "not_received" =
        "not_received";
      if (allFullyReceived) completionStatus = "complete";
      else if (anyReceived) completionStatus = "incomplete";

      // Sync all received lines to products
      for (const item of items) {
        if (item.isReceived) {
          await syncProductFromReceive(ctx, item, order);
        }
      }

      const receivedDates = items
        .map((i) => i.dateReceived)
        .filter((d): d is string => !!d);
      const orderDateReceived =
        receivedDates.sort().at(-1) ??
        (anyReceived ? todayDateString() : null);

      const [archived] = await ctx.db
        .update(inventoryOrders)
        .set({
          status: "archived",
          completionStatus,
          dateReceived: orderDateReceived,
          archivedAt: new Date(),
        })
        .where(eq(inventoryOrders.id, order.id))
        .returning();

      return { ok: true as const, order: archived! };
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
