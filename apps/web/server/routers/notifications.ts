import { z } from "zod";
import { eq, and, isNull, gte, lte, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  appointments,
  patients,
  clients,
  users,
  communications,
  invoices,
  vaccinationRecords,
  practices,
} from "@openpims/db";
import {
  sendAppointmentReminder,
  sendInvoiceEmail,
  sendVaccinationReminder,
} from "@/lib/email";
import { getEmailTemplatesFromSettings } from "@/lib/email-templates";
import {
  buildPortalUrl,
  generatePortalAccessToken,
} from "@/lib/portal-token";
import {
  formatPracticeDate,
  formatPracticeTime,
} from "@/lib/practice-datetime";
import { overdueVaccinations } from "@/lib/vaccination-due";

async function getPracticeEmailContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string
) {
  const [practice] = await db
    .select({
      name: practices.name,
      phone: practices.phone,
      address: practices.address,
      timezone: practices.timezone,
      settings: practices.settings,
    })
    .from(practices)
    .where(eq(practices.id, practiceId))
    .limit(1);
  return {
    practiceName: practice?.name ?? "",
    practicePhone: practice?.phone ?? undefined,
    practiceAddress: practice?.address ?? undefined,
    timezone: practice?.timezone ?? "America/New_York",
    templates: getEmailTemplatesFromSettings(practice?.settings),
  };
}

export const notificationsRouter = createRouter({
  sendAppointmentReminder: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ appointmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [appt] = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          patientName: patients.name,
          clientId: appointments.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt)
          )
        )
        .limit(1);

      if (!appt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      }
      if (!appt.clientEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address on file" });
      }

      const emailCtx = await getPracticeEmailContext(ctx.db, ctx.practiceId);

      const result = await sendAppointmentReminder(
        {
          to: appt.clientEmail,
          clientName: `${appt.clientFirstName} ${appt.clientLastName}`,
          patientName: appt.patientName ?? "Unknown",
          appointmentDate: formatPracticeDate(appt.startTime, emailCtx.timezone),
          appointmentTime: formatPracticeTime(appt.startTime, emailCtx.timezone),
          practiceName: emailCtx.practiceName,
          practicePhone: emailCtx.practicePhone,
          practiceAddress: emailCtx.practiceAddress,
        },
        emailCtx.templates.appointmentReminder
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            result.error ??
            "Failed to send email. Check Resend domain/from address and server logs.",
        });
      }

      await ctx.db.insert(communications).values({
        practiceId: ctx.practiceId,
        clientId: appt.clientId!,
        channel: "email",
        direction: "outbound",
        subject: "Appointment Reminder",
        content: `Appointment reminder sent for ${appt.patientName} on ${formatPracticeDate(appt.startTime, emailCtx.timezone)}`,
        status: "sent",
      });

      return { success: true, emailId: result.id ?? null };
    }),

  sendInvoiceEmail: protectedProcedure
    .use(requireRole("admin", "front_desk"))
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [invoice] = await ctx.db
        .select({
          id: invoices.id,
          total: invoices.total,
          dueDate: invoices.dueDate,
          clientId: invoices.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          clientAccessToken: clients.accessToken,
        })
        .from(invoices)
        .leftJoin(clients, eq(invoices.clientId, clients.id))
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt)
          )
        )
        .limit(1);

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      if (!invoice.clientEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Client does not have an email address on file" });
      }

      const emailCtx = await getPracticeEmailContext(ctx.db, ctx.practiceId);

      let portalUrl: string | undefined;
      if (invoice.clientAccessToken) {
        portalUrl = buildPortalUrl(invoice.clientAccessToken);
      } else if (invoice.clientId) {
        const token = generatePortalAccessToken();
        await ctx.db
          .update(clients)
          .set({ accessToken: token })
          .where(eq(clients.id, invoice.clientId));
        portalUrl = buildPortalUrl(token);
      }

      const result = await sendInvoiceEmail(
        {
          to: invoice.clientEmail,
          clientName: `${invoice.clientFirstName} ${invoice.clientLastName}`,
          invoiceTotal: `$${Number(invoice.total ?? 0).toFixed(2)}`,
          dueDate: invoice.dueDate ?? undefined,
          practiceName: emailCtx.practiceName,
          practicePhone: emailCtx.practicePhone,
          portalUrl,
        },
        emailCtx.templates.invoiceEmail
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            result.error ??
            "Failed to send email. Check Resend domain/from address and server logs.",
        });
      }

      await ctx.db.insert(communications).values({
        practiceId: ctx.practiceId,
        clientId: invoice.clientId,
        channel: "email",
        direction: "outbound",
        subject: "Invoice",
        content: `Invoice sent — total: $${Number(invoice.total ?? 0).toFixed(2)}`,
        status: "sent",
      });

      return { success: true, emailId: result.id ?? null };
    }),

  getUpcomingReminders: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return ctx.db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        status: appointments.status,
        patientName: patients.name,
        clientId: appointments.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        doctorName: users.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .leftJoin(users, eq(appointments.doctorId, users.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, now),
          lte(appointments.startTime, in24h),
          inArray(appointments.status, ["scheduled", "confirmed"])
        )
      )
      .orderBy(appointments.startTime);
  }),

  sendBulkReminders: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ appointmentIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.appointmentIds.length === 0) return { sent: 0, failed: 0 };

      const appts = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          patientName: patients.name,
          clientId: appointments.clientId,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(
          and(
            inArray(appointments.id, input.appointmentIds),
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt)
          )
        );

      let sent = 0;
      let failed = 0;
      const emailCtx = await getPracticeEmailContext(ctx.db, ctx.practiceId);

      for (const appt of appts) {
        if (!appt.clientEmail) { failed++; continue; }
        try {
          const result = await sendAppointmentReminder(
            {
              to: appt.clientEmail,
              clientName: `${appt.clientFirstName} ${appt.clientLastName}`,
              patientName: appt.patientName ?? "Unknown",
              appointmentDate: formatPracticeDate(appt.startTime, emailCtx.timezone),
              appointmentTime: formatPracticeTime(appt.startTime, emailCtx.timezone),
              practiceName: emailCtx.practiceName,
              practicePhone: emailCtx.practicePhone,
              practiceAddress: emailCtx.practiceAddress,
            },
            emailCtx.templates.appointmentReminder
          );
          if (!result.success) {
            failed++;
            continue;
          }
          await ctx.db.insert(communications).values({
            practiceId: ctx.practiceId,
            clientId: appt.clientId!,
            channel: "email",
            direction: "outbound",
            subject: "Appointment Reminder",
            content: `Reminder sent for ${appt.patientName} on ${formatPracticeDate(appt.startTime, emailCtx.timezone)}`,
            status: "sent",
          });
          sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed };
    }),

  getOverdueVaccinations: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: vaccinationRecords.id,
        patientId: patients.id,
        patientName: patients.name,
        clientId: clients.id,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        vaccineName: vaccinationRecords.vaccineName,
        administeredAt: vaccinationRecords.administeredAt,
        nextDueDate: vaccinationRecords.nextDueDate,
      })
      .from(vaccinationRecords)
      .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
      .innerJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(vaccinationRecords.practiceId, ctx.practiceId),
          isNull(vaccinationRecords.deletedAt),
          isNull(patients.deletedAt),
        )
      )
      .orderBy(patients.name);

    const byPatient = new Map<
      string,
      {
        patientId: string;
        patientName: string;
        clientId: string;
        clientFirstName: string;
        clientLastName: string;
        clientEmail: string | null;
        vaccinations: {
          id: string;
          vaccineName: string;
          administeredAt: Date | string | null;
          nextDueDate: string | null;
        }[];
      }
    >();

    for (const row of rows) {
      const existing = byPatient.get(row.patientId);
      const vax = {
        id: row.id,
        vaccineName: row.vaccineName,
        administeredAt: row.administeredAt,
        nextDueDate: row.nextDueDate,
      };
      if (existing) {
        existing.vaccinations.push(vax);
      } else {
        byPatient.set(row.patientId, {
          patientId: row.patientId,
          patientName: row.patientName,
          clientId: row.clientId,
          clientFirstName: row.clientFirstName,
          clientLastName: row.clientLastName,
          clientEmail: row.clientEmail,
          vaccinations: [vax],
        });
      }
    }

    const result: {
      patientId: string;
      patientName: string;
      clientId: string;
      clientFirstName: string;
      clientLastName: string;
      clientEmail: string | null;
      overdueVaccines: { vaccineName: string; nextDueDate: string | null }[];
    }[] = [];

    for (const patient of byPatient.values()) {
      const overdue = overdueVaccinations(patient.vaccinations);
      if (overdue.length === 0) continue;
      result.push({
        patientId: patient.patientId,
        patientName: patient.patientName,
        clientId: patient.clientId,
        clientFirstName: patient.clientFirstName,
        clientLastName: patient.clientLastName,
        clientEmail: patient.clientEmail,
        overdueVaccines: overdue.map((alert) => ({
          vaccineName: alert.protocolLabel,
          nextDueDate: alert.vaccination.nextDueDate ?? null,
        })),
      });
    }

    return result;
  }),

  sendVaccinationReminders: protectedProcedure
    .use(requireRole("admin"))
    .input(z.object({ patientIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.patientIds.length === 0) return { sent: 0, failed: 0 };

      const rows = await ctx.db
        .select({
          id: vaccinationRecords.id,
          patientId: patients.id,
          patientName: patients.name,
          clientId: clients.id,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          clientEmail: clients.email,
          vaccineName: vaccinationRecords.vaccineName,
          administeredAt: vaccinationRecords.administeredAt,
          nextDueDate: vaccinationRecords.nextDueDate,
        })
        .from(vaccinationRecords)
        .innerJoin(patients, eq(vaccinationRecords.patientId, patients.id))
        .innerJoin(clients, eq(patients.clientId, clients.id))
        .where(
          and(
            eq(vaccinationRecords.practiceId, ctx.practiceId),
            isNull(vaccinationRecords.deletedAt),
            isNull(patients.deletedAt),
            inArray(patients.id, input.patientIds),
          )
        );

      const byPatient = new Map<
        string,
        {
          patientName: string;
          clientId: string;
          clientName: string;
          clientEmail: string | null;
          vaccinations: {
            id: string;
            vaccineName: string;
            administeredAt: Date | string | null;
            nextDueDate: string | null;
          }[];
        }
      >();

      for (const row of rows) {
        const existing = byPatient.get(row.patientId);
        const vax = {
          id: row.id,
          vaccineName: row.vaccineName,
          administeredAt: row.administeredAt,
          nextDueDate: row.nextDueDate,
        };
        if (existing) {
          existing.vaccinations.push(vax);
        } else {
          byPatient.set(row.patientId, {
            patientName: row.patientName,
            clientId: row.clientId,
            clientName: `${row.clientFirstName} ${row.clientLastName}`,
            clientEmail: row.clientEmail,
            vaccinations: [vax],
          });
        }
      }

      let sent = 0;
      let failed = 0;
      const emailCtx = await getPracticeEmailContext(ctx.db, ctx.practiceId);

      for (const [, data] of byPatient) {
        const overdue = overdueVaccinations(data.vaccinations);
        if (overdue.length === 0) continue;
        if (!data.clientEmail) {
          failed++;
          continue;
        }
        try {
          for (const alert of overdue) {
            const result = await sendVaccinationReminder(
              {
                to: data.clientEmail,
                clientName: data.clientName,
                patientName: data.patientName,
                vaccineName: alert.protocolLabel,
                dueDate: alert.vaccination.nextDueDate ?? "overdue",
                practiceName: emailCtx.practiceName,
                practicePhone: emailCtx.practicePhone,
              },
              emailCtx.templates.vaccinationReminder
            );
            if (!result.success) {
              failed++;
              continue;
            }
          }
          await ctx.db.insert(communications).values({
            practiceId: ctx.practiceId,
            clientId: data.clientId,
            channel: "email",
            direction: "outbound",
            subject: "Vaccination Reminder",
            content: `Vaccination reminder sent for ${data.patientName}: ${overdue.map((a) => a.protocolLabel).join(", ")}`,
            status: "sent",
          });
          sent++;
        } catch {
          failed++;
        }
      }

      return { sent, failed };
    }),
});
