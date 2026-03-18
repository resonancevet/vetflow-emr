import {
  pgTable,
  uuid,
  varchar,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";

export const files = pgTable(
  "files",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileKey: varchar("file_key", { length: 512 }).notNull(),
    fileUrl: varchar("file_url", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }),
    fileSizeBytes: integer("file_size_bytes"),
    category: varchar("category", { length: 64 }),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: uuid("entity_id"),
  },
  (table) => ({
    practiceIdx: index("files_practice_idx").on(table.practiceId, table.deletedAt),
    entityIdx: index("files_entity_idx").on(table.entityType, table.entityId),
    uploadedByIdx: index("files_uploaded_by_idx").on(table.uploadedBy),
    categoryIdx: index("files_category_idx").on(table.practiceId, table.category),
  }),
);

export const filesRelations = relations(files, ({ one }) => ({
  practice: one(practices, {
    fields: [files.practiceId],
    references: [practices.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));
