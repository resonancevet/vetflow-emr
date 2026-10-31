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
  servicePackageInstallments,
  servicePackageSales,
} from "@openpims/db";
import { calcTax, getEffectiveTaxRatePercent, getEffectiveInventoryMarkupPercent } from "@/lib/tax";
import { chargePriceEachWithMarkup } from "@/lib/inventory-price";
import { applyStockChange } from "../lib/stock";
import { queueInvoiceSync, queuePaymentSync } from "@/lib/quickbooks-sync";
import {
  ensureInvoiceNumber,
} from "../lib/display-ids";
import {
  computePromptPaymentDiscount,
  type PromptPaymentDiscountInput,
} from "@/lib/prompt-payment-discount";
import {
  DEFAULT_LINE_CREDIT_LABEL,
  LINE_CREDIT_KIND,
  PROMPT_PAYMENT_KIND,
  isLineCreditDiscount,
  isPromptPaymentDiscount,
  normalizeLineCreditLabel,
} from "@/lib/line-credit";

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
  /** When set, insert a 100% offsetting discount line with this client-facing label. */
  lineCreditLabel: z.string().max(500).nullable().optional(),
});

type InvoiceItemInput = z.infer<typeof invoiceItemInput>;

function moneyAbs(value: string | number | null | undefined): number {
  return Math.abs(parseFloat(String(value ?? "0")) || 0);
}

function sumPositiveItemTotals(
  items: Array<{ itemType: string; total: string }>
): number {
  return items
    .filter((item) => item.itemType !== "discount")
    .reduce((sum, item) => sum + parseFloat(String(item.total ?? "0")), 0);
}

function sumLineCreditAbs(
  items: Array<{ itemType: string; discountKind?: string | null; total: string }>
): number {
  return items
    .filter((item) => isLineCreditDiscount(item))
    .reduce((sum, item) => sum + moneyAbs(item.total), 0);
}

function sumPromptPaymentAbs(
  items: Array<{ itemType: string; discountKind?: string | null; total: string }>
): number {
  return items
    .filter((item) => isPromptPaymentDiscount(item))
    .reduce((sum, item) => sum + moneyAbs(item.total), 0);
}

async function insertLineCreditsForPricedItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  invoiceId: string,
  pricedItems: Array<InvoiceItemInput & { unitPrice: string; total: string }>,
  insertedRows: Array<{ id: string }>
) {
  const creditRows: Array<{
    invoiceId: string;
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
    itemType: "discount";
    itemId: null;
    discountKind: typeof LINE_CREDIT_KIND;
    linkedItemId: string;
  }> = [];

  for (let i = 0; i < pricedItems.length; i++) {
    const item = pricedItems[i]!;
    const inserted = insertedRows[i];
    const rawLabel = item.lineCreditLabel?.trim();
    if (!rawLabel || !inserted) continue;
    const amount = parseFloat(item.total);
    if (!(amount > 0)) continue;
    let label: string;
    try {
      label = normalizeLineCreditLabel(rawLabel);
    } catch (err) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err instanceof Error ? err.message : "Invalid credit label",
      });
    }
    const neg = (-amount).toFixed(2);
    creditRows.push({
      invoiceId,
      description: label,
      quantity: 1,
      unitPrice: neg,
      total: neg,
      itemType: "discount",
      itemId: null,
      discountKind: LINE_CREDIT_KIND,
      linkedItemId: inserted.id,
    });
  }

  if (creditRows.length > 0) {
    await db.insert(invoiceItems).values(creditRows);
  }

  return creditRows.reduce((sum, row) => sum + moneyAbs(row.total), 0);
}

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

type BillingCtx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  practiceId: string;
};

async function loadDiscountableInvoice(ctx: BillingCtx, invoiceId: string) {
  const [invoice] = await ctx.db
    .select({
      id: invoices.id,
      status: invoices.status,
      paidAmount: invoices.paidAmount,
      isTemplate: invoices.isTemplate,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.practiceId, ctx.practiceId),
        isNull(invoices.deletedAt)
      )
    )
    .limit(1);

  if (!invoice || invoice.isTemplate) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invoice not found",
    });
  }
  if (invoice.status === "void" || invoice.status === "paid") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot change discount on a paid or void invoice",
    });
  }
  if (parseFloat(String(invoice.paidAmount ?? "0")) > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot change discount after a payment has been recorded",
    });
  }
  return invoice;
}

async function recalcInvoiceMoney(
  ctx: BillingCtx,
  invoiceId: string,
  subtotal: number
) {
  const [practice] = await ctx.db
    .select({ settings: practices.settings })
    .from(practices)
    .where(eq(practices.id, ctx.practiceId))
    .limit(1);
  const taxRatePercent = getEffectiveTaxRatePercent(practice?.settings);
  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const tax = calcTax(roundedSubtotal, taxRatePercent);
  const total = Math.round((roundedSubtotal + tax) * 100) / 100;

  await ctx.db
    .update(invoices)
    .set({
      subtotal: roundedSubtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.practiceId, ctx.practiceId)
      )
    );
}

async function applyOrReplacePromptPaymentDiscount(
  ctx: BillingCtx,
  input: { invoiceId: string } & PromptPaymentDiscountInput
) {
  const invoice = await loadDiscountableInvoice(ctx, input.invoiceId);
  const items: Array<{
    id: string;
    itemType: string;
    discountKind: string | null;
    total: string;
  }> = await ctx.db
    .select({
      id: invoiceItems.id,
      itemType: invoiceItems.itemType,
      discountKind: invoiceItems.discountKind,
      total: invoiceItems.total,
    })
    .from(invoiceItems)
    .where(
      and(
        eq(invoiceItems.invoiceId, input.invoiceId),
        isNull(invoiceItems.deletedAt)
      )
    );

  const positiveSubtotal = sumPositiveItemTotals(items);
  const lineCreditTotal = sumLineCreditAbs(items);
  const discountableSubtotal =
    Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;

  let computed;
  try {
    computed = computePromptPaymentDiscount(discountableSubtotal, {
      mode: input.mode,
      value: input.value,
    });
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: err instanceof Error ? err.message : "Invalid discount",
    });
  }

  const promptPaymentIds = items
    .filter((item) => isPromptPaymentDiscount(item))
    .map((item) => item.id);
  if (promptPaymentIds.length > 0) {
    await ctx.db
      .update(invoiceItems)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(invoiceItems.id, promptPaymentIds));
  }

  const unitPrice = (-computed.amount).toFixed(2);
  await ctx.db.insert(invoiceItems).values({
    invoiceId: invoice.id,
    description: computed.description,
    quantity: 1,
    unitPrice,
    total: unitPrice,
    itemType: "discount",
    itemId: null,
    discountKind: PROMPT_PAYMENT_KIND,
    linkedItemId: null,
  });

  const netSubtotal =
    Math.round((discountableSubtotal - computed.amount) * 100) / 100;
  await recalcInvoiceMoney(ctx, invoice.id, netSubtotal);
  void queueInvoiceSync(ctx.db, ctx.practiceId, invoice.id);

  return {
    amount: computed.amount.toFixed(2),
    description: computed.description,
  };
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
      } else {
        // Visit plans live in Catalog — never list legacy estimate templates here
        conditions.push(eq(invoices.isTemplate, false));
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
            invoiceDate: invoices.invoiceDate,
            sentAt: invoices.sentAt,
            createdAt: invoices.createdAt,
            isEstimate: invoices.isEstimate,
            isTemplate: invoices.isTemplate,
            invoiceNumber: invoices.invoiceNumber,
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
          invoiceDate: invoices.invoiceDate,
          sentAt: invoices.sentAt,
          createdAt: invoices.createdAt,
          clientId: invoices.clientId,
          patientId: invoices.patientId,
          isEstimate: invoices.isEstimate,
          isTemplate: invoices.isTemplate,
          name: invoices.name,
          invoiceNumber: invoices.invoiceNumber,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          clientDisplayId: clients.displayId,
          clientAddress: clients.address,
          clientCity: clients.city,
          clientState: clients.state,
          clientZip: clients.zip,
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
        /** Use recordPayment to mark an invoice paid (captures amount + method). */
        status: z.enum(["draft", "finalized", "sent", "overdue", "void"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: invoices.id,
          status: invoices.status,
          isEstimate: invoices.isEstimate,
          isTemplate: invoices.isTemplate,
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

      if (!existing || existing.isEstimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      if (input.status === "finalized" && existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft invoices can be finalized",
        });
      }
      if (input.status === "void") {
        const voidable = ["finalized", "sent", "overdue", "paid"];
        if (!voidable.includes(existing.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Only finalized (or later) invoices can be voided. Delete drafts instead.",
          });
        }
      }
      if (input.status === "sent" && existing.status === "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Finalize the invoice before marking it sent",
        });
      }

      if (input.status === "finalized") {
        await ensureInvoiceNumber(ctx.db, ctx.practiceId, input.id);
      }

      const statusPatch: Record<string, unknown> = {
        status: input.status,
        updatedAt: new Date(),
      };
      if (input.status === "sent") {
        statusPatch.sentAt = new Date();
      }

      const [invoice] = await ctx.db
        .update(invoices)
        .set(statusPatch)
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId)
          )
        )
        .returning();

      if (
        invoice &&
        (input.status === "sent" || input.status === "finalized")
      ) {
        queueInvoiceSync(ctx.db, ctx.practiceId, invoice.id);
      }
      return invoice!;
    }),

  /** Soft-delete draft invoices only. Finalized/sent/paid/void invoices are kept for records. */
  deleteDraftInvoice: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: invoices.id,
          status: invoices.status,
          isEstimate: invoices.isEstimate,
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

      if (!existing || existing.isEstimate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }
      if (existing.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only draft invoices can be deleted. Void finalized or emailed invoices instead.",
        });
      }

      const [deleted] = await ctx.db
        .update(invoices)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId)
          )
        )
        .returning({ id: invoices.id });

      return { ok: true, id: deleted!.id };
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
      if (!clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: isEstimate
            ? "Client is required for estimates. Save reusable line items as a Visit plan in Catalog."
            : "Client is required for invoices",
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

      const positiveSubtotal = pricedItems.reduce((sum, item) => {
        return sum + item.quantity * parseFloat(item.unitPrice);
      }, 0);

      // Invoice numbers are assigned on finalize, not at draft creation.
      const invoiceNumber = null;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          practiceId: ctx.practiceId,
          clientId,
          patientId: input.patientId ?? null,
          appointmentId: input.appointmentId ?? null,
          name,
          status: "draft",
          subtotal: positiveSubtotal.toFixed(2),
          tax: "0.00",
          total: positiveSubtotal.toFixed(2),
          paidAmount: "0.00",
          dueDate: input.dueDate ?? null,
          isEstimate,
          isTemplate: false,
          invoiceNumber,
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

      const lineCreditTotal = await insertLineCreditsForPricedItems(
        ctx.db,
        invoice!.id,
        pricedItems,
        inserted
      );
      const subtotal =
        Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;
      const tax = calcTax(subtotal, taxRatePercent);
      const total = Math.round((subtotal + tax) * 100) / 100;

      await ctx.db
        .update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice!.id));

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

      return {
        ...invoice!,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        stockWarned,
      };
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
      if (!clientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Client is required for estimates. Save reusable line items as a Visit plan in Catalog.",
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

      const existingDiscountItems: Array<{
        id: string;
        description: string;
        quantity: number;
        unitPrice: string;
        total: string;
        discountKind: string | null;
        itemType: "discount";
      }> = (
        await ctx.db
          .select({
            id: invoiceItems.id,
            description: invoiceItems.description,
            quantity: invoiceItems.quantity,
            unitPrice: invoiceItems.unitPrice,
            total: invoiceItems.total,
            discountKind: invoiceItems.discountKind,
          })
          .from(invoiceItems)
          .where(
            and(
              eq(invoiceItems.invoiceId, input.id),
              eq(invoiceItems.itemType, "discount"),
              isNull(invoiceItems.deletedAt)
            )
          )
      ).map(
        (item: {
          id: string;
          description: string;
          quantity: number;
          unitPrice: string;
          total: string;
          discountKind: string | null;
        }) => ({
          ...item,
          itemType: "discount" as const,
        })
      );

      const existingPromptPayment = existingDiscountItems.find((item) =>
        isPromptPaymentDiscount(item)
      );

      const positiveSubtotal = pricedItems.reduce((sum, item) => {
        return sum + item.quantity * parseFloat(item.unitPrice);
      }, 0);

      await ctx.db
        .update(invoiceItems)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(invoiceItems.invoiceId, input.id),
            isNull(invoiceItems.deletedAt)
          )
        );

      const inserted = await ctx.db
        .insert(invoiceItems)
        .values(
          pricedItems.map((item) => ({
            invoiceId: input.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            itemType: item.itemType as "service" | "product",
            itemId: item.itemId ?? null,
          }))
        )
        .returning();

      const lineCreditTotal = await insertLineCreditsForPricedItems(
        ctx.db,
        input.id,
        pricedItems,
        inserted
      );

      const afterCredits =
        Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;
      const priorPromptAmount = existingPromptPayment
        ? moneyAbs(existingPromptPayment.total)
        : 0;
      const cappedPrompt = Math.min(priorPromptAmount, afterCredits);
      if (cappedPrompt > 0 && existingPromptPayment) {
        const neg = (-cappedPrompt).toFixed(2);
        await ctx.db.insert(invoiceItems).values({
          invoiceId: input.id,
          description:
            existingPromptPayment.description || "Prompt payment discount",
          quantity: 1,
          unitPrice: neg,
          total: neg,
          itemType: "discount",
          itemId: null,
          discountKind: PROMPT_PAYMENT_KIND,
          linkedItemId: null,
        });
      }

      const subtotal = Math.round((afterCredits - cappedPrompt) * 100) / 100;
      const tax = calcTax(subtotal, taxRatePercent);
      const total = Math.round((subtotal + tax) * 100) / 100;

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
          isTemplate: false,
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

  // --- Prompt payment discount ---

  applyPromptPaymentDiscount: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        mode: z.enum(["percent", "fixed"]),
        value: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return applyOrReplacePromptPaymentDiscount(ctx, {
        invoiceId: input.invoiceId,
        mode: input.mode,
        value: input.value,
      });
    }),

  removePromptPaymentDiscount: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await loadDiscountableInvoice(ctx, input.invoiceId);
      const items = await ctx.db
        .select({
          id: invoiceItems.id,
          itemType: invoiceItems.itemType,
          discountKind: invoiceItems.discountKind,
          total: invoiceItems.total,
        })
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.invoiceId, input.invoiceId),
            isNull(invoiceItems.deletedAt)
          )
        );

      const promptPaymentIds = items
        .filter((item) => isPromptPaymentDiscount(item))
        .map((item) => item.id);
      if (promptPaymentIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No prompt payment discount on this invoice",
        });
      }

      await ctx.db
        .update(invoiceItems)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(invoiceItems.id, promptPaymentIds));

      const positiveSubtotal = sumPositiveItemTotals(items);
      const lineCreditTotal = sumLineCreditAbs(items);
      const netSubtotal =
        Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;
      await recalcInvoiceMoney(ctx, invoice.id, netSubtotal);

      void queueInvoiceSync(ctx.db, ctx.practiceId, invoice.id);
      return { ok: true as const };
    }),

  /** Mark a product/service line as no-charge with an editable client-facing label. */
  applyLineCredit: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        itemId: z.string().uuid(),
        label: z.string().max(500).default(DEFAULT_LINE_CREDIT_LABEL),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await loadDiscountableInvoice(ctx, input.invoiceId);
      let label: string;
      try {
        label = normalizeLineCreditLabel(input.label || DEFAULT_LINE_CREDIT_LABEL);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Invalid credit label",
        });
      }

      const items = await ctx.db
        .select({
          id: invoiceItems.id,
          itemType: invoiceItems.itemType,
          discountKind: invoiceItems.discountKind,
          linkedItemId: invoiceItems.linkedItemId,
          total: invoiceItems.total,
          description: invoiceItems.description,
        })
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.invoiceId, input.invoiceId),
            isNull(invoiceItems.deletedAt)
          )
        );

      const target = items.find((item) => item.id === input.itemId);
      if (!target || target.itemType === "discount") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Line item not found",
        });
      }

      const amount = parseFloat(String(target.total ?? "0"));
      if (!(amount > 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nothing to credit on this line",
        });
      }

      const existingCreditIds = items
        .filter(
          (item) =>
            isLineCreditDiscount(item) && item.linkedItemId === target.id
        )
        .map((item) => item.id);
      if (existingCreditIds.length > 0) {
        await ctx.db
          .update(invoiceItems)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(inArray(invoiceItems.id, existingCreditIds));
      }

      const neg = (-amount).toFixed(2);
      await ctx.db.insert(invoiceItems).values({
        invoiceId: invoice.id,
        description: label,
        quantity: 1,
        unitPrice: neg,
        total: neg,
        itemType: "discount",
        itemId: null,
        discountKind: LINE_CREDIT_KIND,
        linkedItemId: target.id,
      });

      // Recompute: keep prompt payment capped against remaining after line credits.
      const positiveSubtotal = sumPositiveItemTotals(items);
      const otherLineCredits = items
        .filter(
          (item) =>
            isLineCreditDiscount(item) && item.linkedItemId !== target.id
        )
        .reduce((sum, item) => sum + moneyAbs(item.total), 0);
      const lineCreditTotal = otherLineCredits + amount;
      const afterCredits =
        Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;
      const priorPrompt = sumPromptPaymentAbs(items);
      const promptIds = items
        .filter((item) => isPromptPaymentDiscount(item))
        .map((item) => item.id);
      let promptAmount = Math.min(priorPrompt, afterCredits);
      if (promptIds.length > 0) {
        await ctx.db
          .update(invoiceItems)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(inArray(invoiceItems.id, promptIds));
      }
      if (promptAmount > 0) {
        const promptDesc =
          items.find((item) => isPromptPaymentDiscount(item))?.description ||
          "Prompt payment discount";
        const promptNeg = (-promptAmount).toFixed(2);
        await ctx.db.insert(invoiceItems).values({
          invoiceId: invoice.id,
          description: promptDesc,
          quantity: 1,
          unitPrice: promptNeg,
          total: promptNeg,
          itemType: "discount",
          itemId: null,
          discountKind: PROMPT_PAYMENT_KIND,
          linkedItemId: null,
        });
      }

      const netSubtotal =
        Math.round((afterCredits - promptAmount) * 100) / 100;
      await recalcInvoiceMoney(ctx, invoice.id, netSubtotal);
      void queueInvoiceSync(ctx.db, ctx.practiceId, invoice.id);

      return { label, amount: amount.toFixed(2) };
    }),

  updateLineCreditLabel: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        discountItemId: z.string().uuid(),
        label: z.string().max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await loadDiscountableInvoice(ctx, input.invoiceId);
      let label: string;
      try {
        label = normalizeLineCreditLabel(input.label);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Invalid credit label",
        });
      }

      const [row] = await ctx.db
        .select({
          id: invoiceItems.id,
          itemType: invoiceItems.itemType,
          discountKind: invoiceItems.discountKind,
        })
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.id, input.discountItemId),
            eq(invoiceItems.invoiceId, input.invoiceId),
            isNull(invoiceItems.deletedAt)
          )
        )
        .limit(1);

      if (!row || !isLineCreditDiscount(row)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Line credit not found",
        });
      }

      await ctx.db
        .update(invoiceItems)
        .set({ description: label, updatedAt: new Date() })
        .where(eq(invoiceItems.id, row.id));

      void queueInvoiceSync(ctx.db, ctx.practiceId, input.invoiceId);
      return { label };
    }),

  removeLineCredit: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        /** Either the discount row id or the linked product/service line id. */
        itemId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await loadDiscountableInvoice(ctx, input.invoiceId);
      const items = await ctx.db
        .select({
          id: invoiceItems.id,
          itemType: invoiceItems.itemType,
          discountKind: invoiceItems.discountKind,
          linkedItemId: invoiceItems.linkedItemId,
          total: invoiceItems.total,
          description: invoiceItems.description,
        })
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.invoiceId, input.invoiceId),
            isNull(invoiceItems.deletedAt)
          )
        );

      const creditIds = items
        .filter(
          (item) =>
            isLineCreditDiscount(item) &&
            (item.id === input.itemId || item.linkedItemId === input.itemId)
        )
        .map((item) => item.id);

      if (creditIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No line credit found",
        });
      }

      await ctx.db
        .update(invoiceItems)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(invoiceItems.id, creditIds));

      const remaining = items.filter((item) => !creditIds.includes(item.id));
      const positiveSubtotal = sumPositiveItemTotals(remaining);
      const lineCreditTotal = sumLineCreditAbs(remaining);
      const afterCredits =
        Math.round((positiveSubtotal - lineCreditTotal) * 100) / 100;
      const priorPrompt = sumPromptPaymentAbs(remaining);
      const promptIds = remaining
        .filter((item) => isPromptPaymentDiscount(item))
        .map((item) => item.id);
      const promptAmount = Math.min(priorPrompt, afterCredits);

      if (promptIds.length > 0) {
        await ctx.db
          .update(invoiceItems)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(inArray(invoiceItems.id, promptIds));
      }
      if (promptAmount > 0) {
        const promptDesc =
          remaining.find((item) => isPromptPaymentDiscount(item))
            ?.description || "Prompt payment discount";
        const promptNeg = (-promptAmount).toFixed(2);
        await ctx.db.insert(invoiceItems).values({
          invoiceId: invoice.id,
          description: promptDesc,
          quantity: 1,
          unitPrice: promptNeg,
          total: promptNeg,
          itemType: "discount",
          itemId: null,
          discountKind: PROMPT_PAYMENT_KIND,
          linkedItemId: null,
        });
      }

      const netSubtotal =
        Math.round((afterCredits - promptAmount) * 100) / 100;
      await recalcInvoiceMoney(ctx, invoice.id, netSubtotal);
      void queueInvoiceSync(ctx.db, ctx.practiceId, invoice.id);
      return { ok: true as const };
    }),

  recordPayment: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        invoiceId: z.string().uuid(),
        amount: z.string().refine((v) => parseFloat(v) > 0, "Amount must be positive"),
        method: z.enum([
          "cash",
          "credit_card",
          "debit_card",
          "check",
          "online",
          "venmo",
          "other",
        ]),
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

      if (updates.status === "paid") {
        const [installment] = await ctx.db
          .select({
            id: servicePackageInstallments.id,
            saleId: servicePackageInstallments.saleId,
          })
          .from(servicePackageInstallments)
          .where(
            and(
              eq(servicePackageInstallments.invoiceId, input.invoiceId),
              isNull(servicePackageInstallments.deletedAt)
            )
          )
          .limit(1);
        if (installment) {
          await ctx.db
            .update(servicePackageInstallments)
            .set({ status: "paid", updatedAt: new Date() })
            .where(eq(servicePackageInstallments.id, installment.id));

          const remaining = await ctx.db
            .select({ id: servicePackageInstallments.id })
            .from(servicePackageInstallments)
            .where(
              and(
                eq(servicePackageInstallments.saleId, installment.saleId),
                isNull(servicePackageInstallments.deletedAt),
                inArray(servicePackageInstallments.status, [
                  "scheduled",
                  "invoiced",
                ])
              )
            )
            .limit(1);

          if (remaining.length === 0) {
            await ctx.db
              .update(servicePackageSales)
              .set({ status: "completed", updatedAt: new Date() })
              .where(eq(servicePackageSales.id, installment.saleId));
          } else {
            await ctx.db
              .update(servicePackageSales)
              .set({ status: "active", updatedAt: new Date() })
              .where(
                and(
                  eq(servicePackageSales.id, installment.saleId),
                  eq(servicePackageSales.status, "past_due")
                )
              );
          }
        }
      }

      queuePaymentSync(ctx.db, ctx.practiceId, payment!.id);

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
          message: "Assign a client before converting this estimate to an invoice",
        });
      }

      const [invoice] = await ctx.db
        .update(invoices)
        .set({
          isEstimate: false,
          isTemplate: false,
          status: "draft",
          invoiceNumber: null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.id))
        .returning();

      if (!invoice) throw new Error("Estimate not found");
      return invoice;
    }),
});
