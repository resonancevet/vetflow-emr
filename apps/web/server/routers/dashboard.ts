import { z } from "zod";
import {
  eq,
  and,
  isNull,
  gte,
  lte,
  sql,
  inArray,
  desc,
  or,
  ilike,
  not,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  appointments,
  communications,
  clients,
  patients,
  practices,
  soapNotes,
  invoices,
  visitChecklists,
  visitChecklistItems,
} from "@openpims/db";
import {
  isCallbackAppointmentRequestSubject,
  isOpenAppointmentRequestSubject,
  parseAppointmentRequestContent,
  toCallbackSubject,
} from "@/lib/appointment-request";
import {
  sendAppointmentConfirmation,
  sendAppointmentRequestDeclined,
} from "@/lib/email";
import { getEmailTemplatesFromSettings } from "@/lib/email-templates";
import {
  formatPracticeDate,
  formatPracticeTime,
} from "@/lib/practice-datetime";
import { autoFinalizeStaleSoapNotes } from "@/lib/record-lockdown";

async function loadOpenAppointmentRequest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  requestId: string
) {
  const [row] = await db
    .select({
      id: communications.id,
      subject: communications.subject,
      content: communications.content,
      status: communications.status,
      clientId: communications.clientId,
      patientId: communications.patientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientEmail: clients.email,
      clientPhone: clients.phone,
      patientName: patients.name,
    })
    .from(communications)
    .leftJoin(clients, eq(communications.clientId, clients.id))
    .leftJoin(patients, eq(communications.patientId, patients.id))
    .where(
      and(
        eq(communications.id, requestId),
        eq(communications.practiceId, practiceId),
        eq(communications.channel, "portal"),
        eq(communications.status, "pending"),
        isNull(communications.deletedAt)
      )
    )
    .limit(1);

  if (!row || !isOpenAppointmentRequestSubject(row.subject)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment request not found or already resolved",
    });
  }
  if (!row.clientId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Request is missing a client",
    });
  }
  return row;
}

/** Resolve patient when older portal requests omitted patientId. */
async function resolveRequestPatientId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  clientId: string,
  patientId: string | null,
  content: string | null,
  joinedPatientName: string | null
): Promise<{ patientId: string; patientName: string }> {
  if (patientId) {
    return {
      patientId,
      patientName: joinedPatientName ?? "your pet",
    };
  }

  const parsed = parseAppointmentRequestContent(content);
  const name = parsed.patientName?.trim();
  if (!name) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This request is missing a patient. Open the client record and schedule manually.",
    });
  }

  const matches = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(
      and(
        eq(patients.practiceId, practiceId),
        eq(patients.clientId, clientId),
        ilike(patients.name, name),
        isNull(patients.deletedAt)
      )
    )
    .limit(2);

  if (matches.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Could not find patient "${name}" on this client. Schedule manually from the calendar.`,
    });
  }
  if (matches.length > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Multiple pets named "${name}" — schedule manually from the calendar.`,
    });
  }

  return { patientId: matches[0]!.id, patientName: matches[0]!.name };
}

export const dashboardRouter = createRouter({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    await autoFinalizeStaleSoapNotes(ctx.db);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      todayAppointmentsResult,
      patientsSeenResult,
      pendingSoapsResult,
      pendingApptRequestsResult,
    ] = await Promise.all([
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

      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(soapNotes)
        .where(
          and(
            eq(soapNotes.practiceId, ctx.practiceId),
            isNull(soapNotes.deletedAt),
            isNull(soapNotes.finalizedAt)
          )
        ),

      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(communications)
        .where(
          and(
            eq(communications.practiceId, ctx.practiceId),
            eq(communications.channel, "portal"),
            eq(communications.status, "pending"),
            isNull(communications.deletedAt),
            or(
              ilike(communications.subject, "Appointment request for%"),
              ilike(communications.subject, "Callback: Appointment request%")
            )
          )
        ),
    ]);

    return {
      todayAppointments: Number(todayAppointmentsResult[0]?.count ?? 0),
      patientsSeen: Number(patientsSeenResult[0]?.count ?? 0),
      pendingSoaps: Number(pendingSoapsResult[0]?.count ?? 0),
      pendingAppointmentRequests: Number(
        pendingApptRequestsResult[0]?.count ?? 0
      ),
    };
  }),

  listAppointmentRequests: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: communications.id,
        subject: communications.subject,
        content: communications.content,
        createdAt: communications.createdAt,
        clientId: communications.clientId,
        patientId: communications.patientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        clientPhone: clients.phone,
        patientName: patients.name,
        patientSpecies: patients.species,
        patientBreed: patients.breed,
        patientSex: patients.sex,
        patientDob: patients.dob,
      })
      .from(communications)
      .leftJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(patients, eq(communications.patientId, patients.id))
      .where(
        and(
          eq(communications.practiceId, ctx.practiceId),
          eq(communications.channel, "portal"),
          eq(communications.status, "pending"),
          isNull(communications.deletedAt),
          or(
            ilike(communications.subject, "Appointment request for%"),
            ilike(communications.subject, "Callback: Appointment request%")
          )
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(50);

    return rows.map((row) => {
      const parsed = parseAppointmentRequestContent(row.content);
      return {
        id: row.id,
        createdAt: row.createdAt,
        clientId: row.clientId,
        patientId: row.patientId,
        clientName: [row.clientFirstName, row.clientLastName]
          .filter(Boolean)
          .join(" "),
        clientEmail: row.clientEmail,
        clientPhone: row.clientPhone,
        patientName: row.patientName ?? parsed.patientName,
        patientSpecies: row.patientSpecies,
        patientBreed: row.patientBreed,
        patientSex: row.patientSex,
        patientDob: row.patientDob,
        preferredDate: parsed.preferredDate,
        preferredTime: parsed.preferredTime,
        reason: parsed.reason,
        needsCallback: isCallbackAppointmentRequestSubject(row.subject),
      };
    });
  }),

  approveAppointmentRequest: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        requestId: z.string().uuid(),
        startTime: z.string().min(1),
        endTime: z.string().min(1),
        typeId: z.preprocess(
          (v) => (v === "" || v === null ? undefined : v),
          z.string().uuid().optional()
        ),
        doctorId: z.preprocess(
          (v) => (v === "" || v === null ? undefined : v),
          z.string().uuid().optional()
        ),
        roomId: z.preprocess(
          (v) => (v === "" || v === null ? undefined : v),
          z.string().uuid().optional()
        ),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await loadOpenAppointmentRequest(
        ctx.db,
        ctx.practiceId,
        input.requestId
      );
      const parsed = parseAppointmentRequestContent(request.content);
      const resolved = await resolveRequestPatientId(
        ctx.db,
        ctx.practiceId,
        request.clientId!,
        request.patientId,
        request.content,
        request.patientName
      );
      const patientId = resolved.patientId;

      // Backfill patientId on legacy requests so later actions stay linked.
      if (!request.patientId) {
        await ctx.db
          .update(communications)
          .set({ patientId })
          .where(eq(communications.id, request.id));
      }

      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid appointment date or time",
        });
      }
      if (!(endTime > startTime)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "End time must be after start time",
        });
      }

      if (input.doctorId) {
        const conflicts = await ctx.db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.practiceId, ctx.practiceId),
              eq(appointments.doctorId, input.doctorId),
              isNull(appointments.deletedAt),
              lte(appointments.startTime, endTime),
              gte(appointments.endTime, startTime),
              not(inArray(appointments.status, ["cancelled", "no_show"]))
            )
          )
          .limit(1);
        if (conflicts.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This time slot conflicts with an existing appointment for this doctor.",
          });
        }
      }

      const notesParts = [
        input.notes?.trim() || null,
        parsed.reason ? `Portal request: ${parsed.reason}` : null,
      ].filter(Boolean);

      const [appt] = await ctx.db
        .insert(appointments)
        .values({
          practiceId: ctx.practiceId,
          patientId,
          clientId: request.clientId!,
          typeId: input.typeId,
          doctorId: input.doctorId,
          roomId: input.roomId,
          startTime,
          endTime,
          notes: notesParts.length ? notesParts.join("\n") : undefined,
          status: "scheduled",
        })
        .returning();

      const [practice] = await ctx.db
        .select({
          name: practices.name,
          phone: practices.phone,
          address: practices.address,
          timezone: practices.timezone,
          settings: practices.settings,
        })
        .from(practices)
        .where(eq(practices.id, ctx.practiceId))
        .limit(1);

      await ctx.db
        .update(communications)
        .set({
          status: "read",
          subject: `Scheduled: ${request.subject?.replace(/^Callback:\s*/i, "") ?? "Appointment request"}`,
          content: [
            request.content ?? "",
            "",
            `Resolved: scheduled as appointment ${appt!.id}`,
            `Scheduled for: ${formatPracticeDate(startTime, practice?.timezone)} ${formatPracticeTime(startTime, practice?.timezone)}`,
          ].join("\n"),
        })
        .where(eq(communications.id, request.id));

      let emailSent = false;
      let emailError: string | undefined;
      if (request.clientEmail) {
        const templates = getEmailTemplatesFromSettings(practice?.settings);
        const patientName = resolved.patientName;
        const result = await sendAppointmentConfirmation(
          {
            to: request.clientEmail,
            clientName: [request.clientFirstName, request.clientLastName]
              .filter(Boolean)
              .join(" "),
            patientName,
            appointmentDate: formatPracticeDate(startTime, practice?.timezone),
            appointmentTime: formatPracticeTime(startTime, practice?.timezone),
            practiceName: practice?.name ?? "Your veterinary clinic",
            practicePhone: practice?.phone ?? undefined,
            practiceAddress: practice?.address ?? undefined,
          },
          templates.appointmentConfirmation
        );
        emailSent = result.success;
        emailError = result.error;
      }

      return {
        appointmentId: appt!.id,
        emailSent,
        emailSkipped: !request.clientEmail,
        emailError,
      };
    }),

  markAppointmentRequestCallback: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        requestId: z.string().uuid(),
        note: z.string().min(1).max(5000),
        removeFromList: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await loadOpenAppointmentRequest(
        ctx.db,
        ctx.practiceId,
        input.requestId
      );
      const note = input.note.trim();
      const resolved = await resolveRequestPatientId(
        ctx.db,
        ctx.practiceId,
        request.clientId!,
        request.patientId,
        request.content,
        request.patientName
      ).catch(() => null);

      const patientId = resolved?.patientId ?? request.patientId ?? null;

      if (!request.patientId && patientId) {
        await ctx.db
          .update(communications)
          .set({ patientId })
          .where(eq(communications.id, request.id));
      }

      const baseSubject =
        request.subject?.replace(/^Callback:\s*/i, "") ??
        "Appointment request";

      if (input.removeFromList) {
        await ctx.db
          .update(communications)
          .set({
            status: "read",
            subject: `Callback logged: ${baseSubject}`,
            assignedTo: ctx.user.id,
            content: [
              request.content ?? "",
              "",
              `Callback logged and removed from requests at ${new Date().toISOString()}`,
              `Callback note: ${note}`,
            ].join("\n"),
          })
          .where(eq(communications.id, request.id));
      } else {
        await ctx.db
          .update(communications)
          .set({
            subject: toCallbackSubject(request.subject),
            assignedTo: ctx.user.id,
            content: [
              request.content ?? "",
              "",
              `Marked for callback by staff at ${new Date().toISOString()}`,
              `Callback note: ${note}`,
            ].join("\n"),
          })
          .where(eq(communications.id, request.id));
      }

      await ctx.db.insert(communications).values({
        practiceId: ctx.practiceId,
        clientId: request.clientId!,
        patientId: patientId ?? undefined,
        channel: "phone",
        direction: "outbound",
        subject: `Callback — appointment request${
          resolved?.patientName || request.patientName
            ? ` for ${resolved?.patientName ?? request.patientName}`
            : ""
        }`,
        content: note,
        assignedTo: ctx.user.id,
        status: "read",
      });

      return { success: true, removedFromList: input.removeFromList };
    }),

  declineAppointmentRequest: protectedProcedure
    .use(requireRole("admin", "veterinarian", "front_desk"))
    .input(
      z.object({
        requestId: z.string().uuid(),
        message: z.string().min(1).max(2000),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await loadOpenAppointmentRequest(
        ctx.db,
        ctx.practiceId,
        input.requestId
      );
      const parsed = parseAppointmentRequestContent(request.content);

      let emailSent = false;
      if (input.sendEmail) {
        if (!request.clientEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Client has no email — uncheck email or add an address first",
          });
        }
        const [practice] = await ctx.db
          .select({
            name: practices.name,
            phone: practices.phone,
            address: practices.address,
            settings: practices.settings,
          })
          .from(practices)
          .where(eq(practices.id, ctx.practiceId))
          .limit(1);

        const templates = getEmailTemplatesFromSettings(practice?.settings);
        const result = await sendAppointmentRequestDeclined(
          {
            to: request.clientEmail,
            clientName: [request.clientFirstName, request.clientLastName]
              .filter(Boolean)
              .join(" "),
            patientName:
              request.patientName ?? parsed.patientName ?? "your pet",
            preferredDate: parsed.preferredDate,
            preferredTime: parsed.preferredTime,
            staffMessage: input.message.trim(),
            practiceName: practice?.name ?? "Your veterinary clinic",
            practicePhone: practice?.phone ?? undefined,
            practiceAddress: practice?.address ?? undefined,
          },
          templates.appointmentRequestDeclined
        );
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error ?? "Failed to send decline email",
          });
        }
        emailSent = true;
      }

      await ctx.db
        .update(communications)
        .set({
          status: "read",
          subject: `Declined: ${request.subject?.replace(/^Callback:\s*/i, "") ?? "Appointment request"}`,
          content: [
            request.content ?? "",
            "",
            `Declined: ${input.message.trim()}`,
            emailSent ? "Client emailed." : "No email sent.",
          ].join("\n"),
        })
        .where(eq(communications.id, request.id));

      return { success: true, emailSent };
    }),

  /**
   * Aggregated practice task list: invoices, SOAPs, mailings, follow-ups, calls.
   */
  listTasks: protectedProcedure.query(async ({ ctx }) => {
    await autoFinalizeStaleSoapNotes(ctx.db);

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const fourteenDaysAgo = new Date(todayStart);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const threeDaysAhead = new Date(todayStart);
    threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);

    type Task = {
      id: string;
      category:
        | "invoice"
        | "soap"
        | "mailing"
        | "follow_up"
        | "phone"
        | "other";
      title: string;
      subtitle: string;
      href: string;
      sortAt: Date;
    };

    const tasks: Task[] = [];

    const todayStr = (() => {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    })();
    const sevenDaysAgoStr = (() => {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - 7);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();

    const invoiceRows = await ctx.db
      .select({
        id: invoices.id,
        status: invoices.status,
        invoiceNumber: invoices.invoiceNumber,
        patientId: invoices.patientId,
        clientId: invoices.clientId,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientEmail: clients.email,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        sentAt: invoices.sentAt,
        paidAmount: invoices.paidAmount,
        total: invoices.total,
        updatedAt: invoices.updatedAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(patients, eq(invoices.patientId, patients.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.practiceId, ctx.practiceId),
          eq(invoices.isEstimate, false),
          eq(invoices.isTemplate, false),
          isNull(invoices.deletedAt),
          or(
            and(
              inArray(invoices.status, ["draft", "finalized"]),
              gte(invoices.updatedAt, fourteenDaysAgo)
            ),
            and(
              inArray(invoices.status, ["finalized", "paid"]),
              isNull(invoices.sentAt),
              lte(invoices.invoiceDate, todayStr)
            ),
            and(
              inArray(invoices.status, ["sent", "overdue"]),
              lte(invoices.dueDate, sevenDaysAgoStr),
              sql`CAST(${invoices.paidAmount} AS numeric) < CAST(${invoices.total} AS numeric)`
            )
          )
        )
      )
      .orderBy(desc(invoices.updatedAt))
      .limit(80);

    const seenInvoiceTasks = new Set<string>();
    for (const inv of invoiceRows) {
      const who = [
        inv.patientName,
        [inv.clientFirstName, inv.clientLastName].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ");
      const num = inv.invoiceNumber ? `#${inv.invoiceNumber}` : "Invoice";
      const href = `/billing?highlight=${inv.id}`;
      const sortAt = inv.updatedAt ?? inv.createdAt;

      if (inv.status === "draft") {
        const key = `invoice-finalize-${inv.id}`;
        if (!seenInvoiceTasks.has(key)) {
          seenInvoiceTasks.add(key);
          const pastInvoiceDate =
            inv.invoiceDate != null && inv.invoiceDate <= todayStr;
          tasks.push({
            id: key,
            category: "invoice",
            title: pastInvoiceDate
              ? `Finalize & email ${num}`
              : `Finalize ${num}`,
            subtitle: pastInvoiceDate
              ? `${who || "Draft"} — invoice date passed`
              : who || "Draft invoice",
            href,
            sortAt,
          });
        }
      }

      if (
        (inv.status === "finalized" || inv.status === "paid") &&
        !inv.sentAt
      ) {
        const pastInvoiceDate =
          inv.invoiceDate == null || inv.invoiceDate <= todayStr;
        if (pastInvoiceDate) {
          const key = `invoice-email-${inv.id}`;
          if (!seenInvoiceTasks.has(key)) {
            seenInvoiceTasks.add(key);
            const missingEmail = !inv.clientEmail;
            tasks.push({
              id: key,
              category: "invoice",
              title: missingEmail
                ? `Add client email — ${num}`
                : `Email ${num}`,
              subtitle: missingEmail
                ? `${who || "Client"} — invoice date passed, no email on file`
                : inv.status === "paid"
                  ? `${who || "Client"} — paid invoice ready to send`
                  : `${who || "Finalized"} — invoice date passed`,
              href,
              sortAt,
            });
          }
        } else if (inv.status === "finalized") {
          const key = `invoice-email-${inv.id}`;
          if (!seenInvoiceTasks.has(key)) {
            seenInvoiceTasks.add(key);
            tasks.push({
              id: key,
              category: "invoice",
              title: `Email ${num}`,
              subtitle: who || "Finalized — not yet sent",
              href,
              sortAt,
            });
          }
        }
      }

      if (
        (inv.status === "sent" || inv.status === "overdue") &&
        inv.dueDate &&
        inv.dueDate <= sevenDaysAgoStr &&
        parseFloat(String(inv.paidAmount ?? "0")) <
          parseFloat(String(inv.total ?? "0"))
      ) {
        const key = `invoice-collect-${inv.id}`;
        if (!seenInvoiceTasks.has(key)) {
          seenInvoiceTasks.add(key);
          tasks.push({
            id: key,
            category: "follow_up",
            title: `Follow up — unpaid ${num}`,
            subtitle: who || "Payment past due by 7+ days",
            href,
            sortAt: inv.dueDate ? new Date(`${inv.dueDate}T12:00:00`) : sortAt,
          });
        }
      }
    }

    // Checked-out visits in the last 7 days with no invoice yet.
    const checkedOut = await ctx.db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        clientId: appointments.clientId,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          eq(appointments.status, "checked_out"),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, sevenDaysAgo),
          lte(appointments.startTime, now),
          eq(appointments.isBlock, false)
        )
      )
      .orderBy(desc(appointments.startTime))
      .limit(40);

    if (checkedOut.length > 0) {
      const apptIds = checkedOut.map((a) => a.id);
      const linkedInvoices = await ctx.db
        .select({
          appointmentId: invoices.appointmentId,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt),
            eq(invoices.isEstimate, false),
            inArray(invoices.appointmentId, apptIds)
          )
        );
      const hasInvoice = new Set(
        linkedInvoices
          .map((r) => r.appointmentId)
          .filter((id): id is string => !!id)
      );

      for (const appt of checkedOut) {
        if (hasInvoice.has(appt.id) || !appt.patientId) continue;
        const who = [
          appt.patientName,
          [appt.clientFirstName, appt.clientLastName]
            .filter(Boolean)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" · ");
        tasks.push({
          id: `invoice-create-${appt.id}`,
          category: "invoice",
          title: "Create invoice",
          subtitle: who || "Checked-out visit",
          href: `/billing/new?patientId=${appt.patientId}`,
          sortAt: appt.startTime,
        });
      }
    }

    const soapRows = await ctx.db
      .select({
        id: soapNotes.id,
        patientId: soapNotes.patientId,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        updatedAt: soapNotes.updatedAt,
        createdAt: soapNotes.createdAt,
      })
      .from(soapNotes)
      .leftJoin(patients, eq(soapNotes.patientId, patients.id))
      .leftJoin(clients, eq(patients.clientId, clients.id))
      .where(
        and(
          eq(soapNotes.practiceId, ctx.practiceId),
          isNull(soapNotes.deletedAt),
          isNull(soapNotes.finalizedAt)
        )
      )
      .orderBy(desc(soapNotes.updatedAt))
      .limit(40);

    for (const soap of soapRows) {
      const who = [
        soap.patientName,
        [soap.clientFirstName, soap.clientLastName].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ");
      tasks.push({
        id: `soap-${soap.id}`,
        category: "soap",
        title: "Complete SOAP",
        subtitle: who || "Draft SOAP note",
        href: `/patients/${soap.patientId}`,
        sortAt: soap.updatedAt ?? soap.createdAt,
      });
    }

    const postItems = await ctx.db
      .select({
        itemId: visitChecklistItems.id,
        key: visitChecklistItems.key,
        label: visitChecklistItems.label,
        patientId: visitChecklists.patientId,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        startTime: appointments.startTime,
      })
      .from(visitChecklistItems)
      .innerJoin(
        visitChecklists,
        eq(visitChecklistItems.checklistId, visitChecklists.id)
      )
      .innerJoin(
        appointments,
        eq(visitChecklists.appointmentId, appointments.id)
      )
      .leftJoin(patients, eq(visitChecklists.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          eq(visitChecklists.practiceId, ctx.practiceId),
          eq(visitChecklists.kind, "rabies"),
          eq(visitChecklistItems.phase, "post"),
          isNull(visitChecklistItems.completedAt),
          isNull(visitChecklistItems.deletedAt),
          isNull(visitChecklists.deletedAt),
          isNull(appointments.deletedAt),
          gte(appointments.startTime, fourteenDaysAgo),
          lte(appointments.startTime, threeDaysAhead),
          inArray(visitChecklistItems.key, [
            "sworn_statement_filed",
            "certificate_sent_client",
            "certificate_sent_town",
          ]),
          not(inArray(appointments.status, ["cancelled", "no_show"]))
        )
      )
      .orderBy(desc(appointments.startTime))
      .limit(40);

    for (const item of postItems) {
      const who = [
        item.patientName,
        [item.clientFirstName, item.clientLastName].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(" · ");
      tasks.push({
        id: `mailing-${item.itemId}`,
        category: "mailing",
        title: item.label,
        subtitle: who || "Rabies close-out",
        href: item.patientId ? `/patients/${item.patientId}` : "/patients",
        sortAt: item.startTime,
      });
    }

    const callbackRows = await ctx.db
      .select({
        id: communications.id,
        subject: communications.subject,
        content: communications.content,
        createdAt: communications.createdAt,
        clientId: communications.clientId,
        patientId: communications.patientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        patientName: patients.name,
      })
      .from(communications)
      .leftJoin(clients, eq(communications.clientId, clients.id))
      .leftJoin(patients, eq(communications.patientId, patients.id))
      .where(
        and(
          eq(communications.practiceId, ctx.practiceId),
          eq(communications.channel, "portal"),
          eq(communications.status, "pending"),
          isNull(communications.deletedAt),
          ilike(communications.subject, "Callback: Appointment request%")
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(20);

    for (const row of callbackRows) {
      const clientName = [row.clientFirstName, row.clientLastName]
        .filter(Boolean)
        .join(" ");
      const parsed = parseAppointmentRequestContent(row.content);
      tasks.push({
        id: `phone-${row.id}`,
        category: "phone",
        title: "Phone call to make",
        subtitle: [row.patientName ?? parsed.patientName, clientName]
          .filter(Boolean)
          .join(" · "),
        href: row.clientId ? `/clients/${row.clientId}` : "/clients",
        sortAt: row.createdAt,
      });
    }

    const recentCheckedOut = await ctx.db
      .select({
        appointmentId: appointments.id,
        patientId: appointments.patientId,
        patientName: patients.name,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        checkedOutAt: appointments.endTime,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          eq(appointments.practiceId, ctx.practiceId),
          isNull(appointments.deletedAt),
          eq(appointments.status, "checked_out"),
          gte(appointments.startTime, sevenDaysAgo),
          lte(appointments.startTime, now)
        )
      )
      .orderBy(desc(appointments.startTime))
      .limit(50);

    const followUpPatientIds = [
      ...new Set(
        recentCheckedOut.map((a) => a.patientId).filter((id): id is string => !!id)
      ),
    ];

    if (followUpPatientIds.length > 0) {
      const futureAppointments = await ctx.db
        .select({
          patientId: appointments.patientId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, now),
            inArray(appointments.patientId, followUpPatientIds),
            not(inArray(appointments.status, ["cancelled", "no_show"]))
          )
        );
      const patientsWithFuture = new Set(
        futureAppointments
          .map((r) => r.patientId)
          .filter((id): id is string => !!id)
      );
      const seenPatients = new Set<string>();
      for (const a of recentCheckedOut) {
        if (!a.patientId || patientsWithFuture.has(a.patientId)) continue;
        if (seenPatients.has(a.patientId)) continue;
        seenPatients.add(a.patientId);
        const who = [
          a.patientName,
          [a.clientFirstName, a.clientLastName].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(" · ");
        tasks.push({
          id: `followup-${a.appointmentId}`,
          category: "follow_up",
          title: "Schedule follow-up",
          subtitle: who,
          href: `/schedule?patientId=${a.patientId}`,
          sortAt: a.checkedOutAt ?? a.startTime,
        });
      }
    }

    tasks.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());
    return tasks.slice(0, 60);
  }),
});
