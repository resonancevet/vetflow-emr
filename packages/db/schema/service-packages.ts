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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { clients } from "./clients";
import { patients } from "./patients";
import { users } from "./users";
import { invoices } from "./billing";

export const packageBillingModeEnum = pgEnum("package_billing_mode", [
  "pay_in_full",
  "monthly",
]);

export const packageSaleStatusEnum = pgEnum("package_sale_status", [
  "active",
  "past_due",
  "completed",
  "cancelled",
]);

export const packageInstallmentStatusEnum = pgEnum(
  "package_installment_status",
  ["scheduled", "invoiced", "paid", "waived", "void"]
);

/** Catalog: sellable service packages (not ongoing memberships). */
export const servicePackages = pgTable(
  "service_packages",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    /** Total package price before tax. */
    priceTotal: numeric("price_total", { precision: 10, scale: 2 }).notNull(),
    /** Fixed to 12 for monthly plans in v1; stored for flexibility. */
    installmentCount: integer("installment_count").notNull().default(12),
    allowPayInFull: boolean("allow_pay_in_full").notNull().default(true),
    allowMonthly: boolean("allow_monthly").notNull().default(true),
    taxable: boolean("taxable").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    practiceIdx: index("service_packages_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

/** Optional included line descriptions for staff/client clarity. */
export const servicePackageItems = pgTable(
  "service_package_items",
  {
    ...baseColumns(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    packageIdx: index("service_package_items_package_idx").on(table.packageId),
  })
);

/** A sold package for a client (and optional patient). */
export const servicePackageSales = pgTable(
  "service_package_sales",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    patientId: uuid("patient_id").references(() => patients.id),
    billingMode: packageBillingModeEnum("billing_mode").notNull(),
    status: packageSaleStatusEnum("status").notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    /** Snapshot of package price at sale time. */
    contractTotal: numeric("contract_total", {
      precision: 10,
      scale: 2,
    }).notNull(),
    packageName: varchar("package_name", { length: 255 }).notNull(),
    enrolledBy: uuid("enrolled_by").references(() => users.id),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => ({
    practiceIdx: index("service_package_sales_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
    clientIdx: index("service_package_sales_client_idx").on(table.clientId),
  })
);

export const servicePackageInstallments = pgTable(
  "service_package_installments",
  {
    ...baseColumns(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => servicePackageSales.id),
    sequenceNumber: integer("sequence_number").notNull(),
    dueDate: date("due_date").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: packageInstallmentStatusEnum("status")
      .notNull()
      .default("scheduled"),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
  },
  (table) => ({
    saleIdx: index("service_package_installments_sale_idx").on(table.saleId),
    dueIdx: index("service_package_installments_due_idx").on(
      table.dueDate,
      table.status
    ),
    invoiceUniq: uniqueIndex(
      "service_package_installments_invoice_uniq"
    ).on(table.invoiceId),
  })
);

export const servicePackagesRelations = relations(
  servicePackages,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [servicePackages.practiceId],
      references: [practices.id],
    }),
    items: many(servicePackageItems),
    sales: many(servicePackageSales),
  })
);

export const servicePackageItemsRelations = relations(
  servicePackageItems,
  ({ one }) => ({
    package: one(servicePackages, {
      fields: [servicePackageItems.packageId],
      references: [servicePackages.id],
    }),
  })
);

export const servicePackageSalesRelations = relations(
  servicePackageSales,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [servicePackageSales.practiceId],
      references: [practices.id],
    }),
    package: one(servicePackages, {
      fields: [servicePackageSales.packageId],
      references: [servicePackages.id],
    }),
    client: one(clients, {
      fields: [servicePackageSales.clientId],
      references: [clients.id],
    }),
    patient: one(patients, {
      fields: [servicePackageSales.patientId],
      references: [patients.id],
    }),
    installments: many(servicePackageInstallments),
  })
);

export const servicePackageInstallmentsRelations = relations(
  servicePackageInstallments,
  ({ one }) => ({
    sale: one(servicePackageSales, {
      fields: [servicePackageInstallments.saleId],
      references: [servicePackageSales.id],
    }),
    invoice: one(invoices, {
      fields: [servicePackageInstallments.invoiceId],
      references: [invoices.id],
    }),
  })
);
