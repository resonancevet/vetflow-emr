import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { locations } from "./practices";
import { clients } from "./clients";
import { patients } from "./patients";
import { appointments } from "./scheduling";
import { users } from "./users";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "overdue",
  "void",
]);

export const invoiceItemTypeEnum = pgEnum("invoice_item_type", [
  "service",
  "product",
]);

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "ordered",
  "received",
]);

export const services = pgTable("services", {
  ...baseColumns(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 32 }),
  category: varchar("category", { length: 128 }),
  defaultPrice: numeric("default_price", { precision: 10, scale: 2 }).notNull(),
  taxable: boolean("taxable").notNull().default(true),
});

export const invoices = pgTable(
  "invoices",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    dueDate: date("due_date"),
    isEstimate: boolean("is_estimate").notNull().default(false),
  },
  (table) => ({
    practiceIdx: index("invoices_practice_idx").on(table.practiceId, table.deletedAt),
    clientIdx: index("invoices_client_idx").on(table.clientId),
  })
);

export const invoiceItems = pgTable("invoice_items", {
  ...baseColumns(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  itemType: invoiceItemTypeEnum("item_type").notNull(),
  itemId: uuid("item_id"),
});

export const products = pgTable("products", {
  ...baseColumns(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  locationId: uuid("location_id").references(() => locations.id),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 64 }),
  category: varchar("category", { length: 128 }),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  reorderPoint: integer("reorder_point").default(10),
  lotNumber: varchar("lot_number", { length: 64 }),
  expirationDate: date("expiration_date"),
});

export const suppliers = pgTable("suppliers", {
  ...baseColumns(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  notes: text("notes"),
});

export const purchaseOrders = pgTable("purchase_orders", {
  ...baseColumns(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.id),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "credit_card",
  "debit_card",
  "check",
  "online",
  "other",
]);

export const payments = pgTable("payments", {
  ...baseColumns(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  receivedBy: uuid("received_by").references(() => users.id),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notes: text("notes"),
});

// Relations
export const servicesRelations = relations(services, ({ one }) => ({
  practice: one(practices, {
    fields: [services.practiceId],
    references: [practices.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  practice: one(practices, {
    fields: [invoices.practiceId],
    references: [practices.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [invoices.appointmentId],
    references: [appointments.id],
  }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  receivedByUser: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  practice: one(practices, {
    fields: [products.practiceId],
    references: [practices.id],
  }),
  location: one(locations, {
    fields: [products.locationId],
    references: [locations.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  practice: one(practices, {
    fields: [suppliers.practiceId],
    references: [practices.id],
  }),
}));

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one }) => ({
    practice: one(practices, {
      fields: [purchaseOrders.practiceId],
      references: [practices.id],
    }),
    supplier: one(suppliers, {
      fields: [purchaseOrders.supplierId],
      references: [suppliers.id],
    }),
  })
);
