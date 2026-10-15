import { z } from "zod";
import {
  eq,
  and,
  isNull,
  gte,
  lte,
  inArray,
  desc,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import {
  appointments,
  patients,
  clients,
  vaccinationRecords,
  visitChecklists,
  visitChecklistItems,
} from "@openpims/db";
import { RABIES_CHECKLIST_ITEMS } from "@/lib/rabies-checklist";
import {
  latestVaccinationPerProtocol,
  parseDateOnly,
} from "@/lib/vaccination-due";

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function patientNeedsRabies(
  vaccinations: Array<{
    id: string;
    vaccineName: string;
    administeredAt: Date | string | null;
    nextDueDate: string | null;
  }>,
  horizonDays = 14
): boolean {
  const today = startOfLocalDay();
  const horizon = addDays(today, horizonDays);
  const latest = latestVaccinationPerProtocol(vaccinations);
  const rabies = latest.get("rabies");
  if (!rabies) return true; // never vaccinated → treat as needed
  const due = parseDateOnly(rabies.nextDueDate);
  if (!due) return false;
  due.setHours(0, 0, 0, 0);
  return due <= horizon;
}

async function loadPatientVaccinations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  practiceId: string,
  patientId: string
) {
  return db
    .select({
      id: vaccinationRecords.id,
      vaccineName: vaccinationRecords.vaccineName,
      administeredAt: vaccinationRecords.administeredAt,
      nextDueDate: vaccinationRecords.nextDueDate,
    })
    .from(vaccinationRecords)
    .where(
      and(
        eq(vaccinationRecords.practiceId, practiceId),
        eq(vaccinationRecords.patientId, patientId),
        isNull(vaccinationRecords.deletedAt)
      )
    );
}

async function insertDefaultItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  checklistId: string
) {
  await db.insert(visitChecklistItems).values(
    RABIES_CHECKLIST_ITEMS.map((item) => ({
      checklistId,
      phase: item.phase,
      key: item.key,
      label: item.label,
      sortOrder: item.sortOrder,
      autoCompletable: item.autoCompletable,
    }))
  );
}

/** Ensure a rabies checklist exists for an appointment; return its id. */
export async function ensureRabiesChecklist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: {
    practiceId: string;
    appointmentId: string;
    patientId: string;
  }
) {
  const [existing] = await db
    .select({ id: visitChecklists.id })
    .from(visitChecklists)
    .where(
      and(
        eq(visitChecklists.practiceId, opts.practiceId),
        eq(visitChecklists.appointmentId, opts.appointmentId),
        eq(visitChecklists.kind, "rabies"),
        isNull(visitChecklists.deletedAt)
      )
    )
    .limit(1);

  if (existing) return existing.id as string;

  const [created] = await db
    .insert(visitChecklists)
    .values({
      practiceId: opts.practiceId,
      appointmentId: opts.appointmentId,
      patientId: opts.patientId,
      kind: "rabies",
      status: "open",
    })
    .returning({ id: visitChecklists.id });

  await insertDefaultItems(db, created!.id);
  return created!.id as string;
}

/** Auto-complete certificate post items for the patient's appointment today. */
export async function autoCompleteRabiesCertificateItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: {
    practiceId: string;
    patientId: string;
    userId: string;
    administeredAt?: Date;
  }
) {
  const day = startOfLocalDay(opts.administeredAt ?? new Date());
  const next = addDays(day, 1);

  const appts = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.practiceId, opts.practiceId),
        eq(appointments.patientId, opts.patientId),
        gte(appointments.startTime, day),
        lte(appointments.startTime, next),
        isNull(appointments.deletedAt),
        notCancelled(appointments.status)
      )
    )
    .orderBy(desc(appointments.startTime))
    .limit(3);

  const targets =
    appts.length > 0
      ? appts
      : await db
          .select({
            id: appointments.id,
            patientId: appointments.patientId,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.practiceId, opts.practiceId),
              eq(appointments.patientId, opts.patientId),
              gte(appointments.startTime, addDays(day, -1)),
              lte(appointments.startTime, addDays(day, 2)),
              isNull(appointments.deletedAt),
              notCancelled(appointments.status)
            )
          )
          .orderBy(desc(appointments.startTime))
          .limit(1);

  for (const appt of targets) {
    if (!appt.patientId) continue;
    const checklistId = await ensureRabiesChecklist(db, {
      practiceId: opts.practiceId,
      appointmentId: appt.id,
      patientId: appt.patientId,
    });
    await db
      .update(visitChecklistItems)
      .set({
        completedAt: new Date(),
        completedBy: opts.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(visitChecklistItems.checklistId, checklistId),
          inArray(visitChecklistItems.key, [
            "certificate_generated",
            "certificate_filed",
          ]),
          isNull(visitChecklistItems.completedAt),
          isNull(visitChecklistItems.deletedAt)
        )
      );
    await refreshChecklistStatus(db, checklistId);
  }
}

function notCancelled(statusCol: typeof appointments.status) {
  return sql`${statusCol} not in ('cancelled', 'no_show')`;
}

async function refreshChecklistStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  checklistId: string
) {
  const items = await db
    .select({
      completedAt: visitChecklistItems.completedAt,
    })
    .from(visitChecklistItems)
    .where(
      and(
        eq(visitChecklistItems.checklistId, checklistId),
        isNull(visitChecklistItems.deletedAt)
      )
    );
  const allDone =
    items.length > 0 && items.every((i: { completedAt: Date | null }) => !!i.completedAt);
  await db
    .update(visitChecklists)
    .set({
      status: allDone ? "complete" : "open",
      updatedAt: new Date(),
    })
    .where(eq(visitChecklists.id, checklistId));
}

export const visitChecklistsRouter = createRouter({
  listForDashboard: protectedProcedure
    .input(
      z
        .object({
          daysAhead: z.number().int().min(0).max(14).default(2),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const daysAhead = input?.daysAhead ?? 2;
      const start = startOfLocalDay();
      const end = addDays(start, daysAhead + 1);

      const appts = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          status: appointments.status,
          rabiesPlanned: appointments.rabiesPlanned,
          patientId: appointments.patientId,
          patientName: patients.name,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            gte(appointments.startTime, start),
            lte(appointments.startTime, end),
            isNull(appointments.deletedAt),
            notCancelled(appointments.status)
          )
        )
        .orderBy(appointments.startTime);

      const results: Array<{
        checklistId: string;
        appointmentId: string;
        patientId: string;
        patientName: string;
        clientName: string;
        startTime: Date;
        status: string;
        preTotal: number;
        preDone: number;
        postTotal: number;
        postDone: number;
        items: Array<{
          id: string;
          phase: "pre" | "post";
          key: string;
          label: string;
          completedAt: Date | null;
          autoCompletable: boolean;
        }>;
      }> = [];

      for (const appt of appts) {
        if (!appt.patientId) continue;

        let shouldHave = Boolean(appt.rabiesPlanned);
        if (!shouldHave) {
          const vax = await loadPatientVaccinations(
            ctx.db,
            ctx.practiceId,
            appt.patientId
          );
          shouldHave = patientNeedsRabies(vax);
        }

        // Also keep if checklist already exists (e.g. after admin)
        const [existing] = await ctx.db
          .select({ id: visitChecklists.id })
          .from(visitChecklists)
          .where(
            and(
              eq(visitChecklists.appointmentId, appt.id),
              eq(visitChecklists.kind, "rabies"),
              isNull(visitChecklists.deletedAt)
            )
          )
          .limit(1);

        if (!shouldHave && !existing) continue;

        const checklistId =
          existing?.id ??
          (await ensureRabiesChecklist(ctx.db, {
            practiceId: ctx.practiceId,
            appointmentId: appt.id,
            patientId: appt.patientId,
          }));

        const items = await ctx.db
          .select({
            id: visitChecklistItems.id,
            phase: visitChecklistItems.phase,
            key: visitChecklistItems.key,
            label: visitChecklistItems.label,
            completedAt: visitChecklistItems.completedAt,
            autoCompletable: visitChecklistItems.autoCompletable,
            sortOrder: visitChecklistItems.sortOrder,
          })
          .from(visitChecklistItems)
          .where(
            and(
              eq(visitChecklistItems.checklistId, checklistId),
              isNull(visitChecklistItems.deletedAt)
            )
          )
          .orderBy(visitChecklistItems.sortOrder);

        const pre = items.filter((i) => i.phase === "pre");
        const post = items.filter((i) => i.phase === "post");
        results.push({
          checklistId,
          appointmentId: appt.id,
          patientId: appt.patientId,
          patientName: appt.patientName ?? "Patient",
          clientName: [appt.clientFirstName, appt.clientLastName]
            .filter(Boolean)
            .join(" "),
          startTime: appt.startTime,
          status: appt.status,
          preTotal: pre.length,
          preDone: pre.filter((i) => i.completedAt).length,
          postTotal: post.length,
          postDone: post.filter((i) => i.completedAt).length,
          items: items.map((i) => ({
            id: i.id,
            phase: i.phase as "pre" | "post",
            key: i.key,
            label: i.label,
            completedAt: i.completedAt,
            autoCompletable: i.autoCompletable,
          })),
        });
      }

      return results;
    }),

  getForAppointment: protectedProcedure
    .input(z.object({ appointmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [checklist] = await ctx.db
        .select()
        .from(visitChecklists)
        .where(
          and(
            eq(visitChecklists.practiceId, ctx.practiceId),
            eq(visitChecklists.appointmentId, input.appointmentId),
            eq(visitChecklists.kind, "rabies"),
            isNull(visitChecklists.deletedAt)
          )
        )
        .limit(1);
      if (!checklist) return null;
      const items = await ctx.db
        .select()
        .from(visitChecklistItems)
        .where(
          and(
            eq(visitChecklistItems.checklistId, checklist.id),
            isNull(visitChecklistItems.deletedAt)
          )
        )
        .orderBy(visitChecklistItems.sortOrder);
      return { ...checklist, items };
    }),

  setItemCompleted: protectedProcedure
    .use(requireRole("admin", "veterinarian", "technician", "front_desk"))
    .input(
      z.object({
        itemId: z.string().uuid(),
        completed: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({
          id: visitChecklistItems.id,
          checklistId: visitChecklistItems.checklistId,
          practiceId: visitChecklists.practiceId,
        })
        .from(visitChecklistItems)
        .innerJoin(
          visitChecklists,
          eq(visitChecklistItems.checklistId, visitChecklists.id)
        )
        .where(
          and(
            eq(visitChecklistItems.id, input.itemId),
            eq(visitChecklists.practiceId, ctx.practiceId),
            isNull(visitChecklistItems.deletedAt)
          )
        )
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Checklist item not found",
        });
      }

      await ctx.db
        .update(visitChecklistItems)
        .set({
          completedAt: input.completed ? new Date() : null,
          completedBy: input.completed ? ctx.user.id : null,
          updatedAt: new Date(),
        })
        .where(eq(visitChecklistItems.id, item.id));

      await refreshChecklistStatus(ctx.db, item.checklistId);
      return { ok: true as const };
    }),

  /** Soft gate helper: is sworn_statement_ready checked for today's appt? */
  swornStatementReadyForPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const day = startOfLocalDay();
      const next = addDays(day, 1);
      const [appt] = await ctx.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            eq(appointments.patientId, input.patientId),
            gte(appointments.startTime, day),
            lte(appointments.startTime, next),
            isNull(appointments.deletedAt),
            notCancelled(appointments.status)
          )
        )
        .orderBy(appointments.startTime)
        .limit(1);

      if (!appt) return { ready: true, hasChecklist: false };

      const [checklist] = await ctx.db
        .select({ id: visitChecklists.id })
        .from(visitChecklists)
        .where(
          and(
            eq(visitChecklists.appointmentId, appt.id),
            eq(visitChecklists.kind, "rabies"),
            isNull(visitChecklists.deletedAt)
          )
        )
        .limit(1);

      if (!checklist) return { ready: true, hasChecklist: false };

      const [item] = await ctx.db
        .select({
          completedAt: visitChecklistItems.completedAt,
        })
        .from(visitChecklistItems)
        .where(
          and(
            eq(visitChecklistItems.checklistId, checklist.id),
            eq(visitChecklistItems.key, "sworn_statement_ready"),
            isNull(visitChecklistItems.deletedAt)
          )
        )
        .limit(1);

      return {
        ready: Boolean(item?.completedAt),
        hasChecklist: true,
      };
    }),
});
