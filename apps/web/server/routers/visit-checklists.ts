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
  VISIT_PREP_BASE_ITEMS,
  VISIT_PREP_RABIES_ITEMS,
} from "@/lib/visit-prep-checklist";
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

async function ensureChecklistItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  checklistId: string,
  defs: Array<{
    key: string;
    label: string;
    sortOrder: number;
    phase?: "pre" | "post";
    autoCompletable?: boolean;
  }>
) {
  if (defs.length === 0) return;
  const existing = await db
    .select({ key: visitChecklistItems.key })
    .from(visitChecklistItems)
    .where(
      and(
        eq(visitChecklistItems.checklistId, checklistId),
        isNull(visitChecklistItems.deletedAt)
      )
    );
  const have = new Set(
    existing.map((r: { key: string }) => r.key as string)
  );
  const missing = defs.filter((d) => !have.has(d.key));
  if (missing.length === 0) return;
  await db.insert(visitChecklistItems).values(
    missing.map((item) => ({
      checklistId,
      phase: item.phase ?? "pre",
      key: item.key,
      label: item.label,
      sortOrder: item.sortOrder,
      autoCompletable: item.autoCompletable ?? false,
    }))
  );
}

/** Ensure a visit prep checklist exists; return its id. */
export async function ensureVisitPrepChecklist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  opts: {
    practiceId: string;
    appointmentId: string;
    patientId: string;
    includeRabiesStatement: boolean;
  }
) {
  const [existing] = await db
    .select({ id: visitChecklists.id })
    .from(visitChecklists)
    .where(
      and(
        eq(visitChecklists.practiceId, opts.practiceId),
        eq(visitChecklists.appointmentId, opts.appointmentId),
        eq(visitChecklists.kind, "visit"),
        isNull(visitChecklists.deletedAt)
      )
    )
    .limit(1);

  let checklistId = existing?.id as string | undefined;
  if (!checklistId) {
    const [created] = await db
      .insert(visitChecklists)
      .values({
        practiceId: opts.practiceId,
        appointmentId: opts.appointmentId,
        patientId: opts.patientId,
        kind: "visit",
        status: "open",
      })
      .returning({ id: visitChecklists.id });
    checklistId = created!.id;
  }

  const defs = [
    ...VISIT_PREP_BASE_ITEMS.map((item) => ({
      ...item,
      phase: "pre" as const,
    })),
    ...(opts.includeRabiesStatement
      ? VISIT_PREP_RABIES_ITEMS.map((item) => ({
          ...item,
          phase: "pre" as const,
        }))
      : []),
  ];
  await ensureChecklistItems(db, checklistId!, defs);
  return checklistId!;
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
  /** Prep / pack-list items nested under Upcoming Appointments. */
  listPrepForAppointments: protectedProcedure
    .input(z.object({ appointmentIds: z.array(z.string().uuid()).max(20) }))
    .query(async ({ ctx, input }) => {
      if (input.appointmentIds.length === 0) return [];

      const appts = await ctx.db
        .select({
          id: appointments.id,
          rabiesPlanned: appointments.rabiesPlanned,
          patientId: appointments.patientId,
          isBlock: appointments.isBlock,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.practiceId, ctx.practiceId),
            inArray(appointments.id, input.appointmentIds),
            isNull(appointments.deletedAt)
          )
        );

      const byId = new Map(appts.map((a) => [a.id, a]));
      const results: Array<{
        appointmentId: string;
        checklistId: string;
        items: Array<{
          id: string;
          key: string;
          label: string;
          completedAt: Date | null;
        }>;
      }> = [];

      for (const appointmentId of input.appointmentIds) {
        const appt = byId.get(appointmentId);
        if (!appt?.patientId || appt.isBlock) continue;

        let includeRabiesStatement = Boolean(appt.rabiesPlanned);
        if (!includeRabiesStatement) {
          const vax = await loadPatientVaccinations(
            ctx.db,
            ctx.practiceId,
            appt.patientId
          );
          includeRabiesStatement = patientNeedsRabies(vax);
        }

        if (includeRabiesStatement) {
          await ensureRabiesChecklist(ctx.db, {
            practiceId: ctx.practiceId,
            appointmentId: appt.id,
            patientId: appt.patientId,
          });
        }

        const checklistId = await ensureVisitPrepChecklist(ctx.db, {
          practiceId: ctx.practiceId,
          appointmentId: appt.id,
          patientId: appt.patientId,
          includeRabiesStatement,
        });

        const items = await ctx.db
          .select({
            id: visitChecklistItems.id,
            key: visitChecklistItems.key,
            label: visitChecklistItems.label,
            completedAt: visitChecklistItems.completedAt,
            sortOrder: visitChecklistItems.sortOrder,
          })
          .from(visitChecklistItems)
          .where(
            and(
              eq(visitChecklistItems.checklistId, checklistId),
              eq(visitChecklistItems.phase, "pre"),
              isNull(visitChecklistItems.deletedAt)
            )
          )
          .orderBy(visitChecklistItems.sortOrder);

        results.push({
          appointmentId: appt.id,
          checklistId,
          items: items.map((i) => ({
            id: i.id,
            key: i.key,
            label: i.label,
            completedAt: i.completedAt,
          })),
        });
      }

      return results;
    }),

  /** Open post-visit close-out items (feeds the Task List). */
  listOpenPostItems: protectedProcedure
    .input(
      z
        .object({
          daysBack: z.number().int().min(0).max(60).default(14),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const daysBack = input?.daysBack ?? 14;
      const start = addDays(startOfLocalDay(), -daysBack);
      const end = addDays(startOfLocalDay(), 3);

      const rows = await ctx.db
        .select({
          itemId: visitChecklistItems.id,
          key: visitChecklistItems.key,
          label: visitChecklistItems.label,
          appointmentId: visitChecklists.appointmentId,
          patientId: visitChecklists.patientId,
          patientName: patients.name,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          startTime: appointments.startTime,
          kind: visitChecklists.kind,
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
            eq(visitChecklistItems.phase, "post"),
            isNull(visitChecklistItems.completedAt),
            isNull(visitChecklistItems.deletedAt),
            isNull(visitChecklists.deletedAt),
            isNull(appointments.deletedAt),
            gte(appointments.startTime, start),
            lte(appointments.startTime, end),
            notCancelled(appointments.status)
          )
        )
        .orderBy(desc(appointments.startTime));

      return rows.map((r) => ({
        itemId: r.itemId,
        key: r.key,
        label: r.label,
        appointmentId: r.appointmentId,
        patientId: r.patientId,
        patientName: r.patientName ?? "Patient",
        clientName: [r.clientFirstName, r.clientLastName]
          .filter(Boolean)
          .join(" "),
        startTime: r.startTime,
        kind: r.kind as string,
      }));
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
          key: visitChecklistItems.key,
          appointmentId: visitChecklists.appointmentId,
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

      // Keep visit prep + rabies sworn-statement gates in sync.
      if (
        item.key === "pre_rabies_client_statement" ||
        item.key === "sworn_statement_ready"
      ) {
        const mirrorKey =
          item.key === "pre_rabies_client_statement"
            ? "sworn_statement_ready"
            : "pre_rabies_client_statement";
        const mirrorKind =
          item.key === "pre_rabies_client_statement" ? "rabies" : "visit";
        const [mirrorChecklist] = await ctx.db
          .select({ id: visitChecklists.id })
          .from(visitChecklists)
          .where(
            and(
              eq(visitChecklists.appointmentId, item.appointmentId),
              eq(visitChecklists.kind, mirrorKind),
              isNull(visitChecklists.deletedAt)
            )
          )
          .limit(1);
        if (mirrorChecklist) {
          await ctx.db
            .update(visitChecklistItems)
            .set({
              completedAt: input.completed ? new Date() : null,
              completedBy: input.completed ? ctx.user.id : null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(visitChecklistItems.checklistId, mirrorChecklist.id),
                eq(visitChecklistItems.key, mirrorKey),
                isNull(visitChecklistItems.deletedAt)
              )
            );
          await refreshChecklistStatus(ctx.db, mirrorChecklist.id);
        }
      }

      await refreshChecklistStatus(ctx.db, item.checklistId);
      return { ok: true as const };
    }),

  /** Soft gate helper: is pre-rabies client statement checked for today's appt? */
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

      const [item] = await ctx.db
        .select({
          completedAt: visitChecklistItems.completedAt,
        })
        .from(visitChecklistItems)
        .innerJoin(
          visitChecklists,
          eq(visitChecklistItems.checklistId, visitChecklists.id)
        )
        .where(
          and(
            eq(visitChecklists.appointmentId, appt.id),
            isNull(visitChecklists.deletedAt),
            isNull(visitChecklistItems.deletedAt),
            inArray(visitChecklistItems.key, [
              "pre_rabies_client_statement",
              "sworn_statement_ready",
            ])
          )
        )
        .limit(1);

      if (!item) return { ready: true, hasChecklist: false };

      return {
        ready: Boolean(item.completedAt),
        hasChecklist: true,
      };
    }),
});
