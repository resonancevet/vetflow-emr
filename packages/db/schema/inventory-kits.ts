import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { products } from "./billing";

/** Practice-defined inventory kits (e.g. rabies dose + syringe + needle). */
export const inventoryKits = pgTable(
  "inventory_kits",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    name: varchar("name", { length: 255 }).notNull(),
    /** How this kit appears in the SOAP plan, if different from inventory. */
    planName: varchar("plan_name", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    /** Optional protocol: next vaccine due date = administered date + this interval. */
    dueIntervalValue: integer("due_interval_value"),
    dueIntervalUnit: varchar("due_interval_unit", { length: 16 }),
  },
  (table) => ({
    practiceIdx: index("inventory_kits_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

export const inventoryKitItems = pgTable(
  "inventory_kit_items",
  {
    ...baseColumns(),
    kitId: uuid("kit_id")
      .notNull()
      .references(() => inventoryKits.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    note: text("note"),
  },
  (table) => ({
    kitIdx: index("inventory_kit_items_kit_idx").on(
      table.kitId,
      table.deletedAt
    ),
  })
);

export const inventoryKitsRelations = relations(
  inventoryKits,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [inventoryKits.practiceId],
      references: [practices.id],
    }),
    items: many(inventoryKitItems),
  })
);

export const inventoryKitItemsRelations = relations(
  inventoryKitItems,
  ({ one }) => ({
    kit: one(inventoryKits, {
      fields: [inventoryKitItems.kitId],
      references: [inventoryKits.id],
    }),
    product: one(products, {
      fields: [inventoryKitItems.productId],
      references: [products.id],
    }),
  })
);
