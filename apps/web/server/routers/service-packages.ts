import { z } from "zod";
import { eq, and, isNull, desc, asc, lte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  servicePackages,
  servicePackageItems,
  servicePackageSales,
  servicePackageInstallments,
  invoices,
  invoiceItems,
  practices,
  clients,
  patients,
} from "@openpims/db";
import { calcTax, getEffectiveTaxRatePercent } from "@/lib/tax";
import {
  addMonthsToDateString,
  splitInstallmentAmounts,
  todayDateStringLocal,
} from "@/lib/service-packages";

const packageItemInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
});

async function createInvoiceForInstallment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: {
    practiceId: string;
    clientId: string;
    patientId: string | null;
    packageName: string;
    billingMode: "pay_in_full" | "monthly";
    sequenceNumber: number;
    installmentCount: number;
    amount: string;
    dueDate: string;
    taxable: boolean;
    taxRatePercent: number;
  }
) {
  const subtotal = parseFloat(opts.amount);
  const tax = opts.taxable ? calcTax(subtotal, opts.taxRatePercent) : 0;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const description =
    opts.billingMode === "pay_in_full"
      ? `${opts.packageName} (paid in full)`
      : `${opts.packageName} — Installment ${opts.sequenceNumber} of ${opts.installmentCount}`;

  const [invoice] = await db
    .insert(invoices)
    .values({
      practiceId: opts.practiceId,
      clientId: opts.clientId,
      patientId: opts.patientId,
      name: description,
      status: "sent",
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      paidAmount: "0.00",
      dueDate: opts.dueDate,
      isEstimate: false,
      isTemplate: false,
    })
    .returning();

  await db.insert(invoiceItems).values({
    invoiceId: invoice!.id,
    description,
    quantity: 1,
    unitPrice: opts.amount,
    total: opts.amount,
    itemType: "service",
    itemId: null,
  });

  return invoice!;
}

export const servicePackagesRouter = createRouter({
  listPackages: protectedProcedure.query(async ({ ctx }) => {
    const packages = await ctx.db
      .select()
      .from(servicePackages)
      .where(
        and(
          eq(servicePackages.practiceId, ctx.practiceId),
          isNull(servicePackages.deletedAt)
        )
      )
      .orderBy(asc(servicePackages.name));

    if (packages.length === 0) return [];

    const items = await ctx.db
      .select()
      .from(servicePackageItems)
      .where(
        and(
          inArray(
            servicePackageItems.packageId,
            packages.map((p) => p.id)
          ),
          isNull(servicePackageItems.deletedAt)
        )
      )
      .orderBy(asc(servicePackageItems.sortOrder));

    return packages.map((pkg) => ({
      ...pkg,
      items: items.filter((item) => item.packageId === pkg.id),
    }));
  }),

  getPackage: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [pkg] = await ctx.db
        .select()
        .from(servicePackages)
        .where(
          and(
            eq(servicePackages.id, input.id),
            eq(servicePackages.practiceId, ctx.practiceId),
            isNull(servicePackages.deletedAt)
          )
        )
        .limit(1);
      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }
      const items = await ctx.db
        .select()
        .from(servicePackageItems)
        .where(
          and(
            eq(servicePackageItems.packageId, pkg.id),
            isNull(servicePackageItems.deletedAt)
          )
        )
        .orderBy(asc(servicePackageItems.sortOrder));
      return { ...pkg, items };
    }),

  createPackage: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        priceTotal: z.string().refine((v) => parseFloat(v) > 0),
        installmentCount: z.number().int().min(1).max(24).default(12),
        allowPayInFull: z.boolean().default(true),
        allowMonthly: z.boolean().default(true),
        taxable: z.boolean().default(true),
        isActive: z.boolean().default(true),
        items: z.array(packageItemInput).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.allowPayInFull && !input.allowMonthly) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Allow at least one payment option",
        });
      }
      const [pkg] = await ctx.db
        .insert(servicePackages)
        .values({
          practiceId: ctx.practiceId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          priceTotal: parseFloat(input.priceTotal).toFixed(2),
          installmentCount: input.installmentCount,
          allowPayInFull: input.allowPayInFull,
          allowMonthly: input.allowMonthly,
          taxable: input.taxable,
          isActive: input.isActive,
        })
        .returning();

      if (input.items.length > 0) {
        await ctx.db.insert(servicePackageItems).values(
          input.items.map((item, i) => ({
            packageId: pkg!.id,
            description: item.description.trim(),
            quantity: item.quantity,
            sortOrder: item.sortOrder ?? i,
          }))
        );
      }
      return pkg!;
    }),

  updatePackage: protectedProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).nullable().optional(),
        priceTotal: z
          .string()
          .refine((v) => parseFloat(v) > 0)
          .optional(),
        installmentCount: z.number().int().min(1).max(24).optional(),
        allowPayInFull: z.boolean().optional(),
        allowMonthly: z.boolean().optional(),
        taxable: z.boolean().optional(),
        isActive: z.boolean().optional(),
        items: z.array(packageItemInput).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, items, ...fields } = input;
      const [existing] = await ctx.db
        .select({ id: servicePackages.id })
        .from(servicePackages)
        .where(
          and(
            eq(servicePackages.id, id),
            eq(servicePackages.practiceId, ctx.practiceId),
            isNull(servicePackages.deletedAt)
          )
        )
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.name !== undefined) updateValues.name = fields.name.trim();
      if (fields.description !== undefined) {
        updateValues.description = fields.description?.trim() || null;
      }
      if (fields.priceTotal !== undefined) {
        updateValues.priceTotal = parseFloat(fields.priceTotal).toFixed(2);
      }
      if (fields.installmentCount !== undefined) {
        updateValues.installmentCount = fields.installmentCount;
      }
      if (fields.allowPayInFull !== undefined) {
        updateValues.allowPayInFull = fields.allowPayInFull;
      }
      if (fields.allowMonthly !== undefined) {
        updateValues.allowMonthly = fields.allowMonthly;
      }
      if (fields.taxable !== undefined) updateValues.taxable = fields.taxable;
      if (fields.isActive !== undefined) updateValues.isActive = fields.isActive;

      const [pkg] = await ctx.db
        .update(servicePackages)
        .set(updateValues)
        .where(eq(servicePackages.id, id))
        .returning();

      if (items) {
        await ctx.db
          .update(servicePackageItems)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(servicePackageItems.packageId, id),
              isNull(servicePackageItems.deletedAt)
            )
          );
        if (items.length > 0) {
          await ctx.db.insert(servicePackageItems).values(
            items.map((item, i) => ({
              packageId: id,
              description: item.description.trim(),
              quantity: item.quantity,
              sortOrder: item.sortOrder ?? i,
            }))
          );
        }
      }

      return pkg!;
    }),

  deletePackage: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [pkg] = await ctx.db
        .update(servicePackages)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(servicePackages.id, input.id),
            eq(servicePackages.practiceId, ctx.practiceId),
            isNull(servicePackages.deletedAt)
          )
        )
        .returning();
      if (!pkg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Package not found" });
      }
      return { ok: true };
    }),

  listSales: protectedProcedure
    .input(
      z
        .object({
          clientId: z.string().uuid().optional(),
          patientId: z.string().uuid().optional(),
          status: z
            .enum(["active", "past_due", "completed", "cancelled"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(servicePackageSales.practiceId, ctx.practiceId),
        isNull(servicePackageSales.deletedAt),
      ];
      if (input?.clientId) {
        conditions.push(eq(servicePackageSales.clientId, input.clientId));
      }
      if (input?.patientId) {
        conditions.push(eq(servicePackageSales.patientId, input.patientId));
      }
      if (input?.status) {
        conditions.push(eq(servicePackageSales.status, input.status));
      }

      return ctx.db
        .select({
          id: servicePackageSales.id,
          packageId: servicePackageSales.packageId,
          packageName: servicePackageSales.packageName,
          clientId: servicePackageSales.clientId,
          patientId: servicePackageSales.patientId,
          billingMode: servicePackageSales.billingMode,
          status: servicePackageSales.status,
          startDate: servicePackageSales.startDate,
          endDate: servicePackageSales.endDate,
          contractTotal: servicePackageSales.contractTotal,
          createdAt: servicePackageSales.createdAt,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          patientName: patients.name,
        })
        .from(servicePackageSales)
        .leftJoin(clients, eq(servicePackageSales.clientId, clients.id))
        .leftJoin(patients, eq(servicePackageSales.patientId, patients.id))
        .where(and(...conditions))
        .orderBy(desc(servicePackageSales.createdAt));
    }),

  getSale: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [sale] = await ctx.db
        .select({
          id: servicePackageSales.id,
          packageId: servicePackageSales.packageId,
          packageName: servicePackageSales.packageName,
          clientId: servicePackageSales.clientId,
          patientId: servicePackageSales.patientId,
          billingMode: servicePackageSales.billingMode,
          status: servicePackageSales.status,
          startDate: servicePackageSales.startDate,
          endDate: servicePackageSales.endDate,
          contractTotal: servicePackageSales.contractTotal,
          notes: servicePackageSales.notes,
          createdAt: servicePackageSales.createdAt,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          patientName: patients.name,
        })
        .from(servicePackageSales)
        .leftJoin(clients, eq(servicePackageSales.clientId, clients.id))
        .leftJoin(patients, eq(servicePackageSales.patientId, patients.id))
        .where(
          and(
            eq(servicePackageSales.id, input.id),
            eq(servicePackageSales.practiceId, ctx.practiceId),
            isNull(servicePackageSales.deletedAt)
          )
        )
        .limit(1);

      if (!sale) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      }

      const installments = await ctx.db
        .select({
          id: servicePackageInstallments.id,
          sequenceNumber: servicePackageInstallments.sequenceNumber,
          dueDate: servicePackageInstallments.dueDate,
          amount: servicePackageInstallments.amount,
          status: servicePackageInstallments.status,
          invoiceId: servicePackageInstallments.invoiceId,
          generatedAt: servicePackageInstallments.generatedAt,
          invoiceTotal: invoices.total,
          invoicePaidAmount: invoices.paidAmount,
          invoiceStatus: invoices.status,
        })
        .from(servicePackageInstallments)
        .leftJoin(
          invoices,
          eq(servicePackageInstallments.invoiceId, invoices.id)
        )
        .where(
          and(
            eq(servicePackageInstallments.saleId, sale.id),
            isNull(servicePackageInstallments.deletedAt)
          )
        )
        .orderBy(asc(servicePackageInstallments.sequenceNumber));

      return { ...sale, installments };
    }),

  sellPackage: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        packageId: z.string().uuid(),
        clientId: z.string().uuid(),
        patientId: z.string().uuid().optional(),
        billingMode: z.enum(["pay_in_full", "monthly"]),
        startDate: z.string().optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [pkg] = await ctx.db
        .select()
        .from(servicePackages)
        .where(
          and(
            eq(servicePackages.id, input.packageId),
            eq(servicePackages.practiceId, ctx.practiceId),
            isNull(servicePackages.deletedAt)
          )
        )
        .limit(1);

      if (!pkg || !pkg.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found or inactive",
        });
      }
      if (input.billingMode === "pay_in_full" && !pkg.allowPayInFull) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This package does not allow pay in full",
        });
      }
      if (input.billingMode === "monthly" && !pkg.allowMonthly) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This package does not allow monthly payments",
        });
      }

      const [client] = await ctx.db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, input.clientId),
            eq(clients.practiceId, ctx.practiceId),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (!client) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
      }

      if (input.patientId) {
        const [patient] = await ctx.db
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              eq(patients.id, input.patientId),
              eq(patients.clientId, input.clientId),
              eq(patients.practiceId, ctx.practiceId),
              isNull(patients.deletedAt)
            )
          )
          .limit(1);
        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Patient not found for this client",
          });
        }
      }

      const [practice] = await ctx.db
        .select({ settings: practices.settings })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);
      const taxRatePercent = getEffectiveTaxRatePercent(practice?.settings);

      const startDate = input.startDate || todayDateStringLocal();
      const count =
        input.billingMode === "pay_in_full" ? 1 : pkg.installmentCount;
      const endDate = addMonthsToDateString(
        startDate,
        input.billingMode === "pay_in_full" ? 0 : count - 1
      );
      const amounts = splitInstallmentAmounts(
        parseFloat(pkg.priceTotal),
        count
      );

      const [sale] = await ctx.db
        .insert(servicePackageSales)
        .values({
          practiceId: ctx.practiceId,
          packageId: pkg.id,
          clientId: input.clientId,
          patientId: input.patientId ?? null,
          billingMode: input.billingMode,
          status: "active",
          startDate,
          endDate,
          contractTotal: pkg.priceTotal,
          packageName: pkg.name,
          enrolledBy: ctx.user.id,
          notes: input.notes?.trim() || null,
        })
        .returning();

      const installmentRows = amounts.map((amount, i) => ({
        saleId: sale!.id,
        sequenceNumber: i + 1,
        dueDate: addMonthsToDateString(startDate, i),
        amount,
        status: "scheduled" as const,
      }));

      const inserted = await ctx.db
        .insert(servicePackageInstallments)
        .values(installmentRows)
        .returning();

      // Always invoice the first installment (pay-in-full or first month).
      const first = inserted[0]!;
      const invoice = await createInvoiceForInstallment(ctx.db, {
        practiceId: ctx.practiceId,
        clientId: input.clientId,
        patientId: input.patientId ?? null,
        packageName: pkg.name,
        billingMode: input.billingMode,
        sequenceNumber: 1,
        installmentCount: count,
        amount: first.amount,
        dueDate: first.dueDate,
        taxable: pkg.taxable,
        taxRatePercent,
      });

      await ctx.db
        .update(servicePackageInstallments)
        .set({
          status: "invoiced",
          invoiceId: invoice.id,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(servicePackageInstallments.id, first.id));

      return {
        saleId: sale!.id,
        firstInvoiceId: invoice.id,
        installmentCount: count,
      };
    }),

  cancelSale: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [sale] = await ctx.db
        .select()
        .from(servicePackageSales)
        .where(
          and(
            eq(servicePackageSales.id, input.id),
            eq(servicePackageSales.practiceId, ctx.practiceId),
            isNull(servicePackageSales.deletedAt)
          )
        )
        .limit(1);
      if (!sale) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      }

      await ctx.db
        .update(servicePackageSales)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.reason?.trim() || null,
          updatedAt: new Date(),
        })
        .where(eq(servicePackageSales.id, sale.id));

      await ctx.db
        .update(servicePackageInstallments)
        .set({ status: "void", updatedAt: new Date() })
        .where(
          and(
            eq(servicePackageInstallments.saleId, sale.id),
            eq(servicePackageInstallments.status, "scheduled"),
            isNull(servicePackageInstallments.deletedAt)
          )
        );

      return { ok: true };
    }),

  /** Used by cron and optionally staff to generate due installment invoices. */
  generateDueInstallmentInvoices: protectedProcedure
    .use(requireRole("admin"))
    .mutation(async ({ ctx }) => {
      return generateDueInstallmentsForPractice(ctx.db, ctx.practiceId);
    }),
});

export async function generateDueInstallmentsForPractice(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId?: string
) {
  const today = todayDateStringLocal();
  const conditions = [
    eq(servicePackageInstallments.status, "scheduled"),
    lte(servicePackageInstallments.dueDate, today),
    isNull(servicePackageInstallments.deletedAt),
    isNull(servicePackageSales.deletedAt),
    inArray(servicePackageSales.status, ["active", "past_due"]),
  ];
  if (practiceId) {
    conditions.push(eq(servicePackageSales.practiceId, practiceId));
  }

  const due = await db
    .select({
      installmentId: servicePackageInstallments.id,
      saleId: servicePackageInstallments.saleId,
      sequenceNumber: servicePackageInstallments.sequenceNumber,
      dueDate: servicePackageInstallments.dueDate,
      amount: servicePackageInstallments.amount,
      practiceId: servicePackageSales.practiceId,
      clientId: servicePackageSales.clientId,
      patientId: servicePackageSales.patientId,
      packageName: servicePackageSales.packageName,
      billingMode: servicePackageSales.billingMode,
      packageId: servicePackageSales.packageId,
    })
    .from(servicePackageInstallments)
    .innerJoin(
      servicePackageSales,
      eq(servicePackageInstallments.saleId, servicePackageSales.id)
    )
    .where(and(...conditions))
    .limit(200);

  let created = 0;
  for (const row of due) {
    const [pkg] = await db
      .select({
        taxable: servicePackages.taxable,
        installmentCount: servicePackages.installmentCount,
      })
      .from(servicePackages)
      .where(eq(servicePackages.id, row.packageId))
      .limit(1);

    const [practice] = await db
      .select({ settings: practices.settings })
      .from(practices)
      .where(eq(practices.id, row.practiceId))
      .limit(1);
    const taxRatePercent = getEffectiveTaxRatePercent(practice?.settings);

    const installmentCount =
      row.billingMode === "pay_in_full"
        ? 1
        : (pkg?.installmentCount ?? 12);

    try {
      const invoice = await createInvoiceForInstallment(db, {
        practiceId: row.practiceId,
        clientId: row.clientId,
        patientId: row.patientId,
        packageName: row.packageName,
        billingMode: row.billingMode,
        sequenceNumber: row.sequenceNumber,
        installmentCount,
        amount: row.amount,
        dueDate: row.dueDate,
        taxable: pkg?.taxable ?? true,
        taxRatePercent,
      });

      await db
        .update(servicePackageInstallments)
        .set({
          status: "invoiced",
          invoiceId: invoice.id,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(servicePackageInstallments.id, row.installmentId),
            eq(servicePackageInstallments.status, "scheduled")
          )
        );
      created += 1;
    } catch {
      // Skip failed row; next cron will retry if still scheduled.
    }
  }

  // Mark sales past_due when they have overdue unpaid invoices.
  const overdueSales = await db
    .selectDistinct({ saleId: servicePackageSales.id })
    .from(servicePackageSales)
    .innerJoin(
      servicePackageInstallments,
      eq(servicePackageInstallments.saleId, servicePackageSales.id)
    )
    .innerJoin(
      invoices,
      eq(servicePackageInstallments.invoiceId, invoices.id)
    )
    .where(
      and(
        isNull(servicePackageSales.deletedAt),
        eq(servicePackageSales.status, "active"),
        isNull(servicePackageInstallments.deletedAt),
        eq(servicePackageInstallments.status, "invoiced"),
        sql`${invoices.dueDate} < ${today}::date`,
        sql`CAST(${invoices.paidAmount} AS numeric) < CAST(${invoices.total} AS numeric)`
      )
    );

  for (const row of overdueSales) {
    await db
      .update(servicePackageSales)
      .set({ status: "past_due", updatedAt: new Date() })
      .where(eq(servicePackageSales.id, row.saleId));
  }

  return { scanned: due.length, created };
}
