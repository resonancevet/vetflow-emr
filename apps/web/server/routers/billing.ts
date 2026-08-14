import { z } from "zod";
import { eq, and, isNull, desc, asc, sql, sum, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  invoices,
  invoiceItems,
  services,
  products,
  clients,
  patients,
  payments,
  users,
  practices,
  inventoryUsages,
} from "@openpims/db";
import { calcTax, getEffectiveTaxRatePercent, getEffectiveInventoryMarkupPercent } from "@/lib/tax";
import { chargePriceEachWithMarkup } from "@/lib/inventory-price";
import { applyStockChange } from "../lib/stock";

function parseMoney(value: string): string {
  const n = parseFloat(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Price must be a non-negative number",
    });
  }
  return n.toFixed(2);
}

const invoiceItemInput = z.object({
  description: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.string(),
  itemType: z.enum(["service", "product"]),
  itemId: z.string().uuid().optional(),
  usageId: z.string().uuid().optional(),
});

type InvoiceItemInput = z.infer<typeof invoiceItemInput>;

async function priceInvoiceItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  items: InvoiceItemInput[],
  markupPercent: number
) {
  const productIds = [
    ...new Set(
      items
        .filter((item) => item.itemType === "product" && item.itemId)
        .map((item) => item.itemId!)
    ),
  ];

  const productRows =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            unitPrice: products.unitPrice,
            costPrice: products.costPrice,
          })
          .from(products)
          .where(
            and(
              eq(products.practiceId, practiceId),
              inArray(products.id, productIds),
              isNull(products.deletedAt)
            )
          )
      : [];

  const byId = new Map(
    productRows.map((row: { id: string }) => [row.id, row])
  );

  return items.map((item) => {
    let unitPrice = parseMoney(item.unitPrice);
    if (item.itemType === "product" && item.itemId) {
      const product = byId.get(item.itemId);
      if (product) {
        unitPrice = chargePriceEachWithMarkup(product, markupPercent);
      } else if (markupPercent > 0) {
        unitPrice = chargePriceEachWithMarkup(
          { unitPrice: item.unitPrice, costPrice: item.unitPrice },
          markupPercent
        );
      }
    }
    const quantity = item.quantity;
    return {
      ...item,
      unitPrice,
      total: (quantity * parseFloat(unitPrice)).toFixed(2),
    };
  });
}

export const billingRouter = createRouter({
  listInvoices: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        isEstimate: z.boolean().optional(),
        isTemplate: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(25),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(invoices.practiceId, ctx.practiceId),
        isNull(invoices.deletedAt),
      ];

      if (input.status) {
        conditions.push(eq(invoices.status, input.status as any));
      }

      if (input.isEstimate !== undefined) {
        conditions.push(eq(invoices.isEstimate, input.isEstimate));
      }
      if (input.isTemplate !== undefined) {
        conditions.push(eq(invoices.isTemplate, input.isTemplate));
      }

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: invoices.id,
            status: invoices.status,
            subtotal: invoices.subtotal,
            tax: invoices.tax,
            total: invoices.total,
            paidAmount: invoices.paidAmount,
            dueDate: invoices.dueDate,
            createdAt: invoices.createdAt,
            isEstimate: invoices.isEstimate,
            isTemplate: invoices.isTemplate,
            name: invoices.name,
            clientFirstName: clients.firstName,
            clientLastName: clients.lastName,
            patientName: patients.name,
          })
          .from(invoices)
          .leftJoin(clients, eq(invoices.clientId, clients.id))
          .leftJoin(patients, eq(invoices.patientId, patients.id))
          .where(and(...conditions))
          .orderBy(desc(invoices.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(invoices)
          .where(and(...conditions)),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  getInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await ctx.db
        .select({
          id: invoices.id,
          status: invoices.status,
          subtotal: invoices.subtotal,
          tax: invoices.tax,
          total: invoices.total,
          paidAmount: invoices.paidAmount,
          dueDate: invoices.dueDate,
          createdAt: invoices.createdAt,
          clientId: invoices.clientId,
          patientId: invoices.patientId,
          isEstimate: invoices.isEstimate,
          isTemplate: invoices.isTemplate,
          name: invoices.name,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          patientName: patients.name,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .leftJoin(patients, eq(invoices.patientId, patients.id))
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId)
          )
        )
        .limit(1);

      if (!invoice) throw new Error("Invoice not found");

      const items = await ctx.db
        .select()
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.invoiceId, input.id),
            isNull(invoiceItems.deletedAt)
          )
        );

      return { ...invoice, items };
    }),

  updateInvoiceStatus: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["draft", "sent", "paid", "overdue", "void"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, any> = { status: input.status };
      if (input.status === "paid") {
        // Get the invoice total
        const [inv] = await ctx.db
          .select({ total: invoices.total })
          .from(invoices)
          .where(eq(invoices.id, input.id));
        if (inv) updates.paidAmount = inv.total;
      }

      const [invoice] = await ctx.db
        .update(invoices)
        .set(updates)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return invoice!;
    }),

  listServices: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(services)
      .where(
        and(
          eq(services.practiceId, ctx.practiceId),
          isNull(services.deletedAt)
        )
      )
      .orderBy(asc(services.category), asc(services.name));
  }),

  createService: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        name: z.string().min(1).max(255),
        code: z.string().max(32).nullable().optional(),
        category: z.string().max(128).nullable().optional(),
        defaultPrice: z.string().min(1),
        taxable: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const price = parseMoney(input.defaultPrice);
      const [service] = await ctx.db
        .insert(services)
        .values({
          practiceId: ctx.practiceId,
          name: input.name.trim(),
          code: input.code?.trim() || null,
          category: input.category?.trim() || null,
          defaultPrice: price,
          taxable: input.taxable ?? true,
        })
        .returning();
      return service!;
    }),

  updateService: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        code: z.string().max(32).nullable().optional(),
        category: z.string().max(128).nullable().optional(),
        defaultPrice: z.string().min(1).optional(),
        taxable: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [existing] = await ctx.db
        .select({ id: services.id })
        .from(services)
        .where(
          and(
            eq(services.id, id),
            eq(services.practiceId, ctx.practiceId),
            isNull(services.deletedAt)
          )
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service not found",
        });
      }

      const updateValues: Record<string, unknown> = {};
      if (fields.name !== undefined) updateValues.name = fields.name.trim();
      if (fields.code !== undefined) {
        updateValues.code = fields.code?.trim() || null;
      }
      if (fields.category !== undefined) {
        updateValues.category = fields.category?.trim() || null;
      }
      if (fields.defaultPrice !== undefined) {
        updateValues.defaultPrice = parseMoney(fields.defaultPrice);
      }
      if (fields.taxable !== undefined) updateValues.taxable = fields.taxable;

      const [service] = await ctx.db
        .update(services)
        .set(updateValues)
        .where(
          and(
            eq(services.id, id),
            eq(services.practiceId, ctx.practiceId)
          )
        )
        .returning();
      return service!;
    }),

  deleteService: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [service] = await ctx.db
        .update(services)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(services.id, input.id),
            eq(services.practiceId, ctx.practiceId),
            isNull(services.deletedAt)
          )
        )
        .returning();
      if (!service) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service not found",
        });
      }
      return { ok: true };
    }),

  patientsByClient: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
        })
        .from(patients)
        .where(
          and(
            eq(patients.clientId, input.clientId),
            eq(patients.practiceId, ctx.practiceId),
            isNull(patients.deletedAt)
          )
        )
        .orderBy(patients.name);
    }),

  createInvoice: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        clientId: z.string().uuid().optional(),
        patientId: z.string().uuid().optional(),
        appointmentId: z.string().uuid().optional(),
        name: z.string().max(255).nullable().optional(),
        items: z.array(invoiceItemInput),
        dueDate: z.string().optional(),
        isEstimate: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isEstimate = input.isEstimate ?? false;
      const clientId = input.clientId ?? null;
      const name = input.name?.trim() || null;
      if (!isEstimate && !clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client is required for invoices",
        });
      }
      if (isEstimate && !clientId && !name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name is required to save a template without a client",
        });
      }

      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const taxRatePercent = getEffectiveTaxRatePercent(practice?.settings);
      const markupPercent = getEffectiveInventoryMarkupPercent(
        practice?.settings
      );
      const pricedItems = await priceInvoiceItems(
        ctx.db,
        ctx.practiceId,
        input.items,
        markupPercent
      );

      const subtotal = pricedItems.reduce((sum, item) => {
        return sum + item.quantity * parseFloat(item.unitPrice);
      }, 0);
      const tax = calcTax(subtotal, taxRatePercent);
      const total = Math.round((subtotal + tax) * 100) / 100;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          practiceId: ctx.practiceId,
          clientId,
          patientId: input.patientId ?? null,
          appointmentId: input.appointmentId ?? null,
          name,
          status: "draft",
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          paidAmount: "0.00",
          dueDate: input.dueDate ?? null,
          isEstimate,
          isTemplate: isEstimate && !clientId,
        })
        .returning();

      let inserted: (typeof invoiceItems.$inferSelect)[] = [];
      if (pricedItems.length > 0) {
        inserted = await ctx.db
          .insert(invoiceItems)
          .values(
            pricedItems.map((item) => ({
              invoiceId: invoice!.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              itemType: item.itemType as "service" | "product",
              itemId: item.itemId ?? null,
            }))
          )
          .returning();
      }

      let stockWarned = false;
      if (!input.isEstimate) {
        for (let i = 0; i < inserted.length; i++) {
          const item = pricedItems[i]!;
          const row = inserted[i]!;
          if (item.itemType !== "product" || !item.itemId) continue;

          if (item.usageId) {
            const [usage] = await ctx.db
              .select()
              .from(inventoryUsages)
              .where(
                and(
                  eq(inventoryUsages.id, item.usageId),
                  eq(inventoryUsages.practiceId, ctx.practiceId),
                  isNull(inventoryUsages.deletedAt),
                  isNull(inventoryUsages.invoiceItemId)
                )
              )
              .limit(1);
            if (!usage) throw new Error("Unbilled usage not found");
            if (input.patientId && usage.patientId !== input.patientId) {
              throw new Error("Usage does not belong to this patient");
            }
            await ctx.db
              .update(inventoryUsages)
              .set({ invoiceItemId: row.id, updatedAt: new Date() })
              .where(eq(inventoryUsages.id, usage.id));
            continue;
          }

          const qty = Math.max(1, Math.round(item.quantity));
          const stock = await applyStockChange(ctx, {
            productId: item.itemId,
            quantity: -qty,
            type: "invoice",
            invoiceItemId: row.id,
          });
          if (stock.warned) stockWarned = true;
        }
      }

      return { ...invoice!, stockWarned };
    }),

  updateInvoice: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        clientId: z.string().uuid().nullable().optional(),
        patientId: z.string().uuid().nullable().optional(),
        name: z.string().max(255).nullable().optional(),
        dueDate: z.string().nullable().optional(),
        items: z.array(invoiceItemInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: invoices.id,
          isEstimate: invoices.isEstimate,
          status: invoices.status,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Estimate not found",
        });
      }
      if (!existing.isEstimate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only estimates can be edited",
        });
      }

      const clientId = input.clientId ?? null;
      const name = input.name?.trim() || null;
      if (!clientId && !name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name is required to save a template without a client",
        });
      }

      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const taxRatePercent = getEffectiveTaxRatePercent(practice?.settings);
      const markupPercent = getEffectiveInventoryMarkupPercent(
        practice?.settings
      );
      const pricedItems = await priceInvoiceItems(
        ctx.db,
        ctx.practiceId,
        input.items,
        markupPercent
      );

      const subtotal = pricedItems.reduce((sum, item) => {
        return sum + item.quantity * parseFloat(item.unitPrice);
      }, 0);
      const tax = calcTax(subtotal, taxRatePercent);
      const total = Math.round((subtotal + tax) * 100) / 100;

      await ctx.db
        .update(invoiceItems)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(invoiceItems.invoiceId, input.id),
            isNull(invoiceItems.deletedAt)
          )
        );

      await ctx.db.insert(invoiceItems).values(
        pricedItems.map((item) => ({
          invoiceId: input.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          itemType: item.itemType as "service" | "product",
          itemId: item.itemId ?? null,
        }))
      );

      const [invoice] = await ctx.db
        .update(invoices)
        .set({
          clientId,
          patientId: input.patientId ?? null,
          name,
          dueDate: input.dueDate || null,
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          isTemplate: !clientId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.id))
        .returning();

      return invoice!;
    }),

  listProducts: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(products)
        .where(
          and(
            eq(products.practiceId, ctx.practiceId),
            isNull(products.deletedAt)
          )
        )
        .orderBy(products.name)
        .limit(input.limit);
    }),

  // --- Payments ---

  recordPayment: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.string().refine((v) => parseFloat(v) > 0, "Amount must be positive"),
        method: z.enum(["cash", "credit_card", "debit_card", "check", "online", "other"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Insert payment
      const [payment] = await ctx.db
        .insert(payments)
        .values({
          invoiceId: input.invoiceId,
          amount: input.amount,
          method: input.method,
          receivedBy: ctx.user.id,
          notes: input.notes ?? null,
        })
        .returning();

      // Sum all payments for this invoice
      const [result] = await ctx.db
        .select({ total: sum(payments.amount) })
        .from(payments)
        .where(
          and(
            eq(payments.invoiceId, input.invoiceId),
            isNull(payments.deletedAt)
          )
        );

      const paidAmount = result?.total ?? "0";

      // Get invoice total to check if fully paid
      const [invoice] = await ctx.db
        .select({ total: invoices.total })
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId));

      const updates: Record<string, any> = { paidAmount };
      if (invoice && parseFloat(paidAmount) >= parseFloat(invoice.total)) {
        updates.status = "paid";
      }

      await ctx.db
        .update(invoices)
        .set(updates)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.practiceId, ctx.practiceId)
          )
        );

      return payment!;
    }),

  listPayments: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: payments.id,
          amount: payments.amount,
          method: payments.method,
          receivedAt: payments.receivedAt,
          notes: payments.notes,
          receivedByName: users.name,
        })
        .from(payments)
        .leftJoin(users, eq(payments.receivedBy, users.id))
        .where(
          and(
            eq(payments.invoiceId, input.invoiceId),
            isNull(payments.deletedAt)
          )
        )
        .orderBy(desc(payments.receivedAt));
    }),

  // --- Estimates ---

  convertEstimateToInvoice: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: invoices.id,
          clientId: invoices.clientId,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId),
            eq(invoices.isEstimate, true),
            isNull(invoices.deletedAt)
          )
        )
        .limit(1);
      if (!existing) throw new Error("Estimate not found");
      if (!existing.clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Assign a client before converting this template to an invoice",
        });
      }

      const [invoice] = await ctx.db
        .update(invoices)
        .set({ isEstimate: false, isTemplate: false })
        .where(eq(invoices.id, input.id))
        .returning();

      if (!invoice) throw new Error("Estimate not found");
      return invoice;
    }),
});
