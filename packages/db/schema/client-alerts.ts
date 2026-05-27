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
import { clients } from "./clients";
import { users } from "./users";

export const clientAlertTypeEnum = pgEnum("client_alert_type", [
  "billing",
  "other",
]);

export const clientAlertSeverityEnum = pgEnum("client_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const clientAlerts = pgTable(
  "client_alerts",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    type: clientAlertTypeEnum("type").notNull(),
    severity: clientAlertSeverityEnum("severity").notNull().default("warning"),
    title: varchar("title", { length: 255 }).notNull(),
    notes: text("notes"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    clientIdx: index("client_alerts_client_idx").on(
      table.clientId,
      table.deletedAt
    ),
    practiceIdx: index("client_alerts_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

export const clientAlertsRelations = relations(clientAlerts, ({ one }) => ({
  practice: one(practices, {
    fields: [clientAlerts.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [clientAlerts.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [clientAlerts.createdBy],
    references: [users.id],
  }),
}));
