import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";
import { users } from "./users";
import { appointments } from "./scheduling";

export const intakeSignatureMethodEnum = pgEnum("intake_signature_method", [
  "typed",
  "drawn",
]);

export const intakeSignatureSectionEnum = pgEnum("intake_signature_section", [
  "agreement",
  "media",
  "registration",
]);

/** Staff-sent one-time invite for new-client paperwork. */
export const intakeInvites = pgTable(
  "intake_invites",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    email: varchar("email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    invitedBy: uuid("invited_by").references(() => users.id),
  },
  (table) => ({
    clientIdx: index("intake_invites_client_idx").on(
      table.clientId,
      table.createdAt
    ),
    practiceIdx: index("intake_invites_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    expiresIdx: index("intake_invites_expires_idx").on(table.expiresAt),
  })
);

export type IntakeHistoryPayload = {
  vaccinationHistory?: string;
  allergiesText?: string;
  currentMedications?: string;
  diet?: string;
  previousVeterinarian?: string;
  pastIllnessesSurgeries?: string;
  behavioralConcerns?: string;
  ageAsOfToday?: string;
};

export const intakeSubmissions = pgTable(
  "intake_submissions",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => intakeInvites.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    agreementVersion: varchar("agreement_version", { length: 64 }).notNull(),
    mediaConsent: boolean("media_consent").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (table) => ({
    clientIdx: index("intake_submissions_client_idx").on(
      table.clientId,
      table.submittedAt
    ),
    practiceIdx: index("intake_submissions_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    inviteIdx: index("intake_submissions_invite_idx").on(table.inviteId),
  })
);

export const intakeSignatures = pgTable(
  "intake_signatures",
  {
    ...baseColumns(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => intakeSubmissions.id),
    section: intakeSignatureSectionEnum("section").notNull(),
    method: intakeSignatureMethodEnum("method").notNull(),
    typedName: varchar("typed_name", { length: 255 }),
    signatureData: text("signature_data"),
    signedAt: timestamp("signed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    submissionIdx: index("intake_signatures_submission_idx").on(
      table.submissionId
    ),
  })
);

export const intakeInvitesRelations = relations(intakeInvites, ({ one }) => ({
  practice: one(practices, {
    fields: [intakeInvites.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [intakeInvites.clientId],
    references: [clients.id],
  }),
  inviter: one(users, {
    fields: [intakeInvites.invitedBy],
    references: [users.id],
  }),
}));

export const intakeSubmissionsRelations = relations(
  intakeSubmissions,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [intakeSubmissions.practiceId],
      references: [practices.id],
    }),
    invite: one(intakeInvites, {
      fields: [intakeSubmissions.inviteId],
      references: [intakeInvites.id],
    }),
    client: one(clients, {
      fields: [intakeSubmissions.clientId],
      references: [clients.id],
    }),
    signatures: many(intakeSignatures),
  })
);

export const intakeSignaturesRelations = relations(
  intakeSignatures,
  ({ one }) => ({
    submission: one(intakeSubmissions, {
      fields: [intakeSignatures.submissionId],
      references: [intakeSubmissions.id],
    }),
  })
);
