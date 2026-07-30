import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { clients } from "./clients";
import { practices } from "./practices";

/** One-time email magic-link tokens for portal login (store hash only). */
export const portalLoginTokens = pgTable(
  "portal_login_tokens",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => ({
    clientIdx: index("portal_login_tokens_client_idx").on(
      table.clientId,
      table.createdAt
    ),
    expiresIdx: index("portal_login_tokens_expires_idx").on(table.expiresAt),
  })
);

export const portalLoginTokensRelations = relations(
  portalLoginTokens,
  ({ one }) => ({
    practice: one(practices, {
      fields: [portalLoginTokens.practiceId],
      references: [practices.id],
    }),
    client: one(clients, {
      fields: [portalLoginTokens.clientId],
      references: [clients.id],
    }),
  })
);
