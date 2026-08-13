import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { users } from "./users";
import { patients } from "./patients";
import { appointments } from "./scheduling";
import { products, inventoryOrderItems, invoiceItems } from "./billing";

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "receive",
  "reverse_receive",
  "use",
  "invoice",
  "adjustment",
]);

export const inventoryUsageSourceEnum = pgEnum("inventory_usage_source", [
  "vaccination",
  "prescription",
  "administration",
  "supply",
]);

export const inventoryUsages = pgTable(
  "inventory_usages",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    sourceType: inventoryUsageSourceEnum("source_type").notNull(),
    sourceId: uuid("source_id"),
    note: text("note"),
    invoiceItemId: uuid("invoice_item_id").references(() => invoiceItems.id),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (table) => ({
    patientIdx: index("inventory_usages_patient_idx").on(table.patientId),
    practiceIdx: index("inventory_usages_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    unbilledIdx: index("inventory_usages_unbilled_idx").on(
      table.practiceId,
      table.invoiceItemId
    ),
  })
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    type: stockMovementTypeEnum("type").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    orderItemId: uuid("order_item_id").references(() => inventoryOrderItems.id),
    usageId: uuid("usage_id").references(() => inventoryUsages.id),
    invoiceItemId: uuid("invoice_item_id").references(() => invoiceItems.id),
  },
  (table) => ({
    productIdx: index("stock_movements_product_idx").on(
      table.productId,
      table.createdAt
    ),
    practiceIdx: index("stock_movements_practice_idx").on(
      table.practiceId,
      table.createdAt
    ),
  })
);

export const inventoryUsagesRelations = relations(
  inventoryUsages,
  ({ one }) => ({
    practice: one(practices, {
      fields: [inventoryUsages.practiceId],
      references: [practices.id],
    }),
    patient: one(patients, {
      fields: [inventoryUsages.patientId],
      references: [patients.id],
    }),
    product: one(products, {
      fields: [inventoryUsages.productId],
      references: [products.id],
    }),
    invoiceItem: one(invoiceItems, {
      fields: [inventoryUsages.invoiceItemId],
      references: [invoiceItems.id],
    }),
  })
);

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  practice: one(practices, {
    fields: [stockMovements.practiceId],
    references: [practices.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  usage: one(inventoryUsages, {
    fields: [stockMovements.usageId],
    references: [inventoryUsages.id],
  }),
}));
