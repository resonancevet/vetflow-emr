import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";
import { patients } from "./patients";
import { invoices } from "./billing";

export const claimStatusEnum = pgEnum("claim_status", [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "denied",
  "paid",
]);

export const insurancePolicies = pgTable(
  "insurance_policies",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    providerName: varchar("provider_name", { length: 255 }).notNull(),
    policyNumber: varchar("policy_number", { length: 128 }),
    groupNumber: varchar("group_number", { length: 128 }),
    phoneNumber: varchar("phone_number", { length: 32 }),
    coverageType: varchar("coverage_type", { length: 128 }),
    deductible: numeric("deductible", { precision: 10, scale: 2 }),
    coveragePercent: integer("coverage_percent"),
    maxAnnualBenefit: numeric("max_annual_benefit", { precision: 10, scale: 2 }),
    effectiveDate: date("effective_date"),
    expirationDate: date("expiration_date"),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("insurance_policies_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    patientIdx: index("insurance_policies_patient_idx").on(table.patientId),
    clientIdx: index("insurance_policies_client_idx").on(table.clientId),
  })
);

export const insuranceClaims = pgTable(
  "insurance_claims",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => insurancePolicies.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    claimNumber: varchar("claim_number", { length: 128 }),
    status: claimStatusEnum("status").notNull().default("draft"),
    claimAmount: numeric("claim_amount", { precision: 10, scale: 2 }).notNull(),
    approvedAmount: numeric("approved_amount", { precision: 10, scale: 2 }),
    deniedReason: text("denied_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => ({
    practiceIdx: index("insurance_claims_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    policyIdx: index("insurance_claims_policy_idx").on(table.policyId),
    statusIdx: index("insurance_claims_status_idx").on(table.status),
  })
);

// Relations
export const insurancePoliciesRelations = relations(
  insurancePolicies,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [insurancePolicies.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [insurancePolicies.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [insurancePolicies.patientId],
      references: [patients.id],
    }),
    claims: many(insuranceClaims),
  })
);

export const insuranceClaimsRelations = relations(
  insuranceClaims,
  ({ one }) => ({
    practice: one(practices, {
      fields: [insuranceClaims.practiceId],
      references: [practices.id],
    }),
    policy: one(insurancePolicies, {
      fields: [insuranceClaims.policyId],
      references: [insurancePolicies.id],
    }),
    invoice: one(invoices, {
      fields: [insuranceClaims.invoiceId],
      references: [invoices.id],
    }),
  })
);
