import { eq, and, isNull, gte, lte, sql, inArray } from "drizzle-orm";
import { createRouter, protectedProcedure } from "../trpc";
import { appointments, invoices } from "@openpims/db";

export const dashboardRouter = createRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      todayAppointmentsResult,
      patientsSeenResult,
      pendingInvoicesResult,
    ] = await Promise.all([
      // Today's appointments count
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd)
          )
        ),

      // Patients seen today (checked_out)
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd),
            eq(appointments.status, "checked_out")
          )
        ),

      // Pending invoices (sent or overdue)
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt),
            inArray(invoices.status, ["sent", "overdue"])
          )
        ),
    ]);

    return {
      todayAppointments: Number(todayAppointmentsResult[0]?.count ?? 0),
      patientsSeen: Number(patientsSeenResult[0]?.count ?? 0),
      pendingInvoices: Number(pendingInvoicesResult[0]?.count ?? 0),
    };
  }),
});
