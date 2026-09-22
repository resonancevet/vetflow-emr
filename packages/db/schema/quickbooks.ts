import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { baseColumns } from "./common";
import { practices } from "./practices";

export const quickbooksEntityTypeEnum = pgEnum("quickbooks_entity_type", [
  "customer",
  "invoice",
  "payment",
]);

/** OAuth connection + account mapping for one practice → one QBO company. */
export const quickbooksConnections = pgTable(
  "quickbooks_connections",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    realmId: varchar("realm_id", { length: 64 }).notNull(),
    companyName: varchar("company_name", { length: 255 }),
    /** AES-GCM ciphertext of the access token. */
    accessTokenEnc: text("access_token_enc").notNull(),
    /** AES-GCM ciphertext of the refresh token. */
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }).notNull(),
    /** QBO income account used for invoice lines when no catalog item is mapped. */
    incomeAccountId: varchar("income_account_id", { length: 64 }),
    /** QBO deposit / undeposited-funds account for payments. */
    depositAccountId: varchar("deposit_account_id", { length: 64 }),
    /** Shared Service item used for all invoice line descriptions. */
    defaultItemId: varchar("default_item_id", { length: 64 }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => ({
    practiceUniq: uniqueIndex("quickbooks_connections_practice_uniq").on(
      table.practiceId
    ),
    realmIdx: index("quickbooks_connections_realm_idx").on(table.realmId),
  })
);

/** Maps local EMR ids to QuickBooks entity ids. */
export const quickbooksEntityLinks = pgTable(
  "quickbooks_entity_links",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    entityType: quickbooksEntityTypeEnum("entity_type").notNull(),
    localId: uuid("local_id").notNull(),
    qboId: varchar("qbo_id", { length: 64 }).notNull(),
  },
  (table) => ({
    localUniq: uniqueIndex("quickbooks_entity_links_local_uniq").on(
      table.practiceId,
      table.entityType,
      table.localId
    ),
  })
);
