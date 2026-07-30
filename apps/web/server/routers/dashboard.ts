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
  invoices,
  communications,
  clients,
  patients,
  practices,
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

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      todayAppointmentsResult,
      patientsSeenResult,
      pendingInvoicesResult,
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
        .from(invoices)
        .where(
          and(
            eq(invoices.practiceId, ctx.practiceId),
            isNull(invoices.deletedAt),
            inArray(invoices.status, ["sent", "overdue"])
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
      pendingInvoices: Number(pendingInvoicesResult[0]?.count ?? 0),
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

      await ctx.db
        .update(communications)
        .set({
          status: "read",
          subject: `Scheduled: ${request.subject?.replace(/^Callback:\s*/i, "") ?? "Appointment request"}`,
          content: [
            request.content ?? "",
            "",
            `Resolved: scheduled as appointment ${appt!.id}`,
            `Scheduled for: ${formatDate(startTime)} ${formatTime(startTime)}`,
          ].join("\n"),
        })
        .where(eq(communications.id, request.id));

      let emailSent = false;
      let emailError: string | undefined;
      if (request.clientEmail) {
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
        const patientName = resolved.patientName;
        const result = await sendAppointmentConfirmation(
          {
            to: request.clientEmail,
            clientName: [request.clientFirstName, request.clientLastName]
              .filter(Boolean)
              .join(" "),
            patientName,
            appointmentDate: formatDate(startTime),
            appointmentTime: formatTime(startTime),
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
});
