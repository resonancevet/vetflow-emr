import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { patients } from "./patients";
import { users } from "./users";

export const patientAlertTypeEnum = pgEnum("patient_alert_type", [
  "behavior",
  "medical",
  "financial",
  "other",
]);

export const patientAlertSeverityEnum = pgEnum("patient_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const patientAlerts = pgTable(
  "patient_alerts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    type: patientAlertTypeEnum("type").notNull(),
    severity: patientAlertSeverityEnum("severity").notNull().default("info"),
    title: varchar("title", { length: 255 }).notNull(),
    notes: text("notes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    patientIdx: index("patient_alerts_patient_idx").on(
      table.patientId,
      table.deletedAt
    ),
    practiceIdx: index("patient_alerts_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

export const patientAlertsRelations = relations(patientAlerts, ({ one }) => ({
  practice: one(practices, {
    fields: [patientAlerts.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [patientAlerts.patientId],
    references: [patients.id],
  }),
  creator: one(users, {
    fields: [patientAlerts.createdBy],
    references: [users.id],
  }),
}));
