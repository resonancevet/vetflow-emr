import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

/** Standard base columns for every table */
export function baseColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  };
}

/** Standard tenant-scoped columns (base + practice_id) */
export function tenantColumns(practiceRef: ReturnType<typeof pgTable>) {
  return {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practiceRef.id),
  };
}
