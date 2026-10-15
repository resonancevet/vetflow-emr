import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { appointments } from "./scheduling";
import { users } from "./users";

export const visitChecklistKindEnum = pgEnum("visit_checklist_kind", [
  "rabies",
  "visit",
]);

export const visitChecklistPhaseEnum = pgEnum("visit_checklist_phase", [
  "pre",
  "post",
]);

export const visitChecklistStatusEnum = pgEnum("visit_checklist_status", [
  "open",
  "complete",
]);

/** Pre/post visit checklist tied to an appointment (visit prep + rabies). */
export const visitChecklists = pgTable(
  "visit_checklists",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    kind: visitChecklistKindEnum("kind").notNull().default("rabies"),
    status: visitChecklistStatusEnum("status").notNull().default("open"),
  },
  (table) => ({
    practiceIdx: index("visit_checklists_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    appointmentIdx: index("visit_checklists_appointment_idx").on(
      table.appointmentId
    ),
    patientIdx: index("visit_checklists_patient_idx").on(table.patientId),
    appointmentKindUniq: uniqueIndex(
      "visit_checklists_appointment_kind_uniq"
    ).on(table.appointmentId, table.kind),
  })
);

export const visitChecklistItems = pgTable(
  "visit_checklist_items",
  {
    ...baseColumns(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => visitChecklists.id),
    phase: visitChecklistPhaseEnum("phase").notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    autoCompletable: boolean("auto_completable").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id),
  },
  (table) => ({
    checklistIdx: index("visit_checklist_items_checklist_idx").on(
      table.checklistId
    ),
    checklistKeyUniq: uniqueIndex("visit_checklist_items_checklist_key_uniq").on(
      table.checklistId,
      table.key
    ),
  })
);

export const visitChecklistsRelations = relations(
  visitChecklists,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [visitChecklists.practiceId],
      references: [practices.id],
    }),
    appointment: one(appointments, {
      fields: [visitChecklists.appointmentId],
      references: [appointments.id],
    }),
    patient: one(patients, {
      fields: [visitChecklists.patientId],
      references: [patients.id],
    }),
    items: many(visitChecklistItems),
  })
);

export const visitChecklistItemsRelations = relations(
  visitChecklistItems,
  ({ one }) => ({
    checklist: one(visitChecklists, {
      fields: [visitChecklistItems.checklistId],
      references: [visitChecklists.id],
    }),
    completedByUser: one(users, {
      fields: [visitChecklistItems.completedBy],
      references: [users.id],
    }),
  })
);
