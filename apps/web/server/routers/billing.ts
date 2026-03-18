import { z } from "zod";
import { eq, and, isNull, desc, sql, sum } from "drizzle-orm";
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
} from "@openpims/db";

export const billingRouter = createRouter({
  listInvoices: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        isEstimate: z.boolean().optional(),
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
        .where(eq(invoiceItems.invoiceId, input.id));

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
      .orderBy(services.name);
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
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        items: z.array(
          z.object({
            description: z.string(),
            quantity: z.number().min(1),
            unitPrice: z.string(),
            itemType: z.enum(["service", "product"]),
            itemId: z.string().uuid().optional(),
          })
        ),
        dueDate: z.string().optional(),
        isEstimate: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subtotal = input.items.reduce((sum, item) => {
        return sum + item.quantity * parseFloat(item.unitPrice);
      }, 0);
      const tax = Math.round(subtotal * 0.08 * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      const [invoice] = await ctx.db
        .insert(invoices)
        .values({
          practiceId: ctx.practiceId,
          clientId: input.clientId,
          patientId: input.patientId ?? null,
          status: "draft",
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
          paidAmount: "0.00",
          dueDate: input.dueDate ?? null,
          isEstimate: input.isEstimate ?? false,
        })
        .returning();

      if (input.items.length > 0) {
        await ctx.db.insert(invoiceItems).values(
          input.items.map((item) => ({
            invoiceId: invoice!.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: (item.quantity * parseFloat(item.unitPrice)).toFixed(2),
            itemType: item.itemType as "service" | "product",
            itemId: item.itemId ?? null,
          }))
        );
      }

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
      const [invoice] = await ctx.db
        .update(invoices)
        .set({ isEstimate: false })
        .where(
          and(
            eq(invoices.id, input.id),
            eq(invoices.practiceId, ctx.practiceId),
            eq(invoices.isEstimate, true)
          )
        )
        .returning();

      if (!invoice) throw new Error("Estimate not found");
      return invoice;
    }),
});
