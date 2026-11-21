import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { clients } from "./clients";
import { patients } from "./patients";
import { appointments } from "./scheduling";

/** Staff follow-up reminders that surface on the dashboard task list when due. */
export const staffReminders = pgTable(
  "staff_reminders",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    title: varchar("title", { length: 255 }).notNull(),
    notes: text("notes"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => users.id),
  },
  (table) => ({
    practiceDueIdx: index("staff_reminders_practice_due_idx").on(
      table.practiceId,
      table.dueAt
    ),
    patientIdx: index("staff_reminders_patient_idx").on(table.patientId),
    clientIdx: index("staff_reminders_client_idx").on(table.clientId),
  })
);

export const staffRemindersRelations = relations(staffReminders, ({ one }) => ({
  practice: one(practices, {
    fields: [staffReminders.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [staffReminders.clientId],
    references: [clients.id],
  }),
  patient: one(patients, {
    fields: [staffReminders.patientId],
    references: [patients.id],
  }),
  createdByUser: one(users, {
    fields: [staffReminders.createdBy],
    references: [users.id],
  }),
}));
