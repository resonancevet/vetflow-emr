import { eq, and, gte, lte, isNull, sql, desc } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import {
  invoices,
  invoiceItems,
  services,
  products,
  appointments,
  users,
} from "@openpims/db";

export const reportsRouter = createRouter({
  revenue: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const baseConds = [
      eq(invoices.practiceId, ctx.practiceId),
      isNull(invoices.deletedAt),
      eq(invoices.status, "paid"),
    ];

    const [thisMonthResult, lastMonthResult, dailyRows] = await Promise.all([
      // This month revenue
      ctx.db
        .select({
          total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...baseConds, gte(invoices.createdAt, thisMonthStart))),

      // Last month revenue
      ctx.db
        .select({
          total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            ...baseConds,
            gte(invoices.createdAt, lastMonthStart),
            lte(invoices.createdAt, lastMonthEnd)
          )
        ),

      // Daily revenue last 30 days
      ctx.db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${invoices.createdAt}), 'Mon DD')`,
          amount: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(and(...baseConds, gte(invoices.createdAt, thirtyDaysAgo)))
        .groupBy(sql`date_trunc('day', ${invoices.createdAt})`)
        .orderBy(sql`date_trunc('day', ${invoices.createdAt})`),
    ]);

    return {
      thisMonth: parseFloat(String(thisMonthResult[0]?.total ?? "0")),
      lastMonth: parseFloat(String(lastMonthResult[0]?.total ?? "0")),
      daily: dailyRows.map((r) => ({
        date: r.date,
        amount: parseFloat(String(r.amount)),
      })),
    };
  }),

  appointments: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseConds = [
      eq(appointments.practiceId, ctx.practiceId),
      isNull(appointments.deletedAt),
      gte(appointments.startTime, monthStart),
    ];

    const [totalResult, completedResult, noShowResult, cancelledResult, byDoctor] =
      await Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds)),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "checked_out"))),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "no_show"))),

        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(and(...baseConds, eq(appointments.status, "cancelled"))),

        // By doctor breakdown
        ctx.db
          .select({
            doctorName: users.name,
            total: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'checked_out')::int`,
          })
          .from(appointments)
          .leftJoin(users, eq(appointments.doctorId, users.id))
          .where(and(...baseConds))
          .groupBy(users.name)
          .orderBy(sql`count(*) desc`),
      ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const completed = Number(completedResult[0]?.count ?? 0);
    const noShows = Number(noShowResult[0]?.count ?? 0);
    const cancelled = Number(cancelledResult[0]?.count ?? 0);
    const fillRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      noShows,
      cancelled,
      fillRate,
      byDoctor: byDoctor.map((d) => ({
        doctorName: d.doctorName ?? "Unassigned",
        total: Number(d.total),
        completed: Number(d.completed),
      })),
    };
  }),

  topServices: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        name: sql<string>`coalesce(${services.name}, ${invoiceItems.description})`,
        count: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${invoiceItems.total}::numeric), 0)`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .leftJoin(
        services,
        and(
          eq(invoiceItems.itemId, services.id),
          eq(invoiceItems.itemType, "service")
        )
      )
      .where(
        and(
          eq(invoices.practiceId, ctx.practiceId),
          isNull(invoices.deletedAt),
          eq(invoiceItems.itemType, "service")
        )
      )
      .groupBy(services.name, invoiceItems.description)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return rows.map((r) => ({
      name: r.name,
      count: Number(r.count),
      revenue: parseFloat(String(r.revenue)),
    }));
  }),

  inventoryAlerts: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const ninetyDaysFromNow = new Date(now);
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const baseConds = [
      eq(products.practiceId, ctx.practiceId),
      isNull(products.deletedAt),
    ];

    const [lowStock, expiring] = await Promise.all([
      ctx.db
        .select({
          name: products.name,
          sku: products.sku,
          stockQuantity: products.stockQuantity,
          reorderPoint: products.reorderPoint,
        })
        .from(products)
        .where(
          and(
            ...baseConds,
            sql`${products.stockQuantity} <= coalesce(${products.reorderPoint}, 10)`
          )
        )
        .orderBy(products.stockQuantity),

      ctx.db
        .select({
          name: products.name,
          sku: products.sku,
          expirationDate: products.expirationDate,
          stockQuantity: products.stockQuantity,
        })
        .from(products)
        .where(
          and(
            ...baseConds,
            sql`${products.expirationDate} is not null`,
            lte(products.expirationDate, ninetyDaysFromNow.toISOString().split("T")[0])
          )
        )
        .orderBy(products.expirationDate),
    ]);

    return { lowStock, expiring };
  }),
});
