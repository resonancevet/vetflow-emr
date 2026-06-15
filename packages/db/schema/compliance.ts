import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { patients } from "./patients";
import { clients } from "./clients";
import { appointments } from "./scheduling";
import { soapNotes, procedures } from "./clinical";
import { files } from "./files";

export const examStatusEnum = pgEnum("exam_status", [
  "wnl",
  "abnormal",
  "not_examined",
]);

export const consentDecisionEnum = pgEnum("consent_decision", [
  "consented",
  "declined",
]);

export const administrationRouteEnum = pgEnum("administration_route", [
  "oral",
  "topical",
  "subcutaneous",
  "intramuscular",
  "intravenous",
  "other",
]);

/** Structured vitals and physical exam status per visit/encounter. */
export const examVitals = pgTable(
  "exam_vitals",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    soapNoteId: uuid("soap_note_id").references(() => soapNotes.id),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    weightKg: numeric("weight_kg", { precision: 8, scale: 3 }),
    temperatureF: numeric("temperature_f", { precision: 5, scale: 2 }),
    heartRate: integer("heart_rate"),
    respiratoryRate: integer("respiratory_rate"),
    examStatus: examStatusEnum("exam_status").notNull().default("wnl"),
    examNotes: text("exam_notes"),
  },
  (table) => ({
    patientIdx: index("exam_vitals_patient_idx").on(table.patientId),
    practiceIdx: index("exam_vitals_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Client consent or decline of a recommendation (Vet 701.01(b)(16)). */
export const clientConsents = pgTable(
  "client_consents",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    recommendation: text("recommendation").notNull(),
    decision: consentDecisionEnum("decision").notNull(),
    risks: text("risks"),
    benefits: text("benefits"),
    estimatedCost: varchar("estimated_cost", { length: 128 }),
    notes: text("notes"),
    documentedAt: timestamp("documented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    patientIdx: index("client_consents_patient_idx").on(table.patientId),
    practiceIdx: index("client_consents_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Persisted discharge instructions (source of truth for PDF export). */
export const dischargeInstructions = pgTable(
  "discharge_instructions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    visitDate: date("visit_date").notNull(),
    diagnosis: text("diagnosis"),
    doctorName: varchar("doctor_name", { length: 255 }),
    medications: jsonb("medications").$type<
      Array<{
        name: string;
        dosage: string;
        frequency: string;
        instructions?: string;
      }>
    >(),
    instructions: jsonb("instructions").$type<string[]>().notNull().default([]),
    followUpDate: date("follow_up_date"),
    followUpNotes: text("follow_up_notes"),
    restrictions: jsonb("restrictions").$type<string[]>(),
    emergencyNotes: text("emergency_notes"),
    pdfFileId: uuid("pdf_file_id").references(() => files.id),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    patientIdx: index("discharge_instructions_patient_idx").on(table.patientId),
    practiceIdx: index("discharge_instructions_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Medications/treatments administered in-clinic with route, time, response. */
export const treatmentAdministrations = pgTable(
  "treatment_administrations",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    administeredBy: uuid("administered_by")
      .notNull()
      .references(() => users.id),
    medicationName: varchar("medication_name", { length: 255 }).notNull(),
    dosage: varchar("dosage", { length: 128 }),
    route: administrationRouteEnum("route"),
    administeredAt: timestamp("administered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    responseToTreatment: text("response_to_treatment"),
    notes: text("notes"),
  },
  (table) => ({
    patientIdx: index("treatment_admin_patient_idx").on(table.patientId),
    practiceIdx: index("treatment_admin_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Boarding/hospitalization custody dates (Vet 701.01(b)(5)). */
export const patientCustody = pgTable(
  "patient_custody",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    custodyStart: timestamp("custody_start", { withTimezone: true }).notNull(),
    custodyEnd: timestamp("custody_end", { withTimezone: true }),
    reason: varchar("reason", { length: 255 }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    patientIdx: index("patient_custody_patient_idx").on(table.patientId),
    practiceIdx: index("patient_custody_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Structured anesthesia monitoring record linked to a procedure. */
export const anesthesiaRecords = pgTable(
  "anesthesia_records",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    procedureId: uuid("procedure_id").references(() => procedures.id),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    protocol: text("protocol"),
    vitalSignsLog: text("vital_signs_log"),
    complications: text("complications"),
    notes: text("notes"),
  },
  (table) => ({
    patientIdx: index("anesthesia_records_patient_idx").on(table.patientId),
    practiceIdx: index("anesthesia_records_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Team members involved in a procedure (dental, surgery, etc.). */
export const procedureTeamMembers = pgTable(
  "procedure_team_members",
  {
    ...baseColumns(),
    procedureId: uuid("procedure_id")
      .notNull()
      .references(() => procedures.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 128 }),
  },
  (table) => ({
    procedureIdx: index("procedure_team_procedure_idx").on(table.procedureId),
  })
);

export const examVitalsRelations = relations(examVitals, ({ one }) => ({
  practice: one(practices, {
    fields: [examVitals.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [examVitals.patientId],
    references: [patients.id],
  }),
  recorder: one(users, {
    fields: [examVitals.recordedBy],
    references: [users.id],
  }),
}));

export const clientConsentsRelations = relations(clientConsents, ({ one }) => ({
  practice: one(practices, {
    fields: [clientConsents.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [clientConsents.patientId],
    references: [patients.id],
  }),
  client: one(clients, {
    fields: [clientConsents.clientId],
    references: [clients.id],
  }),
  author: one(users, {
    fields: [clientConsents.authorId],
    references: [users.id],
  }),
}));

export const dischargeInstructionsRelations = relations(
  dischargeInstructions,
  ({ one }) => ({
    practice: one(practices, {
      fields: [dischargeInstructions.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [dischargeInstructions.patientId],
      references: [patients.id],
    }),
    author: one(users, {
      fields: [dischargeInstructions.authorId],
      references: [users.id],
    }),
    pdfFile: one(files, {
      fields: [dischargeInstructions.pdfFileId],
      references: [files.id],
    }),
  })
);

export const treatmentAdministrationsRelations = relations(
  treatmentAdministrations,
  ({ one }) => ({
    practice: one(practices, {
      fields: [treatmentAdministrations.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [treatmentAdministrations.patientId],
      references: [patients.id],
    }),
    administrator: one(users, {
      fields: [treatmentAdministrations.administeredBy],
      references: [users.id],
    }),
  })
);

export const patientCustodyRelations = relations(patientCustody, ({ one }) => ({
  practice: one(practices, {
    fields: [patientCustody.practiceId],
    references: [practices.id],
  }),
  patient: one(patients, {
    fields: [patientCustody.patientId],
    references: [patients.id],
  }),
  recorder: one(users, {
    fields: [patientCustody.recordedBy],
    references: [users.id],
  }),
}));

export const anesthesiaRecordsRelations = relations(
  anesthesiaRecords,
  ({ one }) => ({
    practice: one(practices, {
      fields: [anesthesiaRecords.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [anesthesiaRecords.patientId],
      references: [patients.id],
    }),
    procedure: one(procedures, {
      fields: [anesthesiaRecords.procedureId],
      references: [procedures.id],
    }),
    recorder: one(users, {
      fields: [anesthesiaRecords.recordedBy],
      references: [users.id],
    }),
  })
);

export const procedureTeamMembersRelations = relations(
  procedureTeamMembers,
  ({ one }) => ({
    procedure: one(procedures, {
      fields: [procedureTeamMembers.procedureId],
      references: [procedures.id],
    }),
    user: one(users, {
      fields: [procedureTeamMembers.userId],
      references: [users.id],
    }),
  })
);
