import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { baseColumns } from "./common";
import { practices } from "./practices";
import { invoiceItemTypeEnum } from "./billing";

export const treatmentTemplates = pgTable(
  "treatment_templates",
  {
    ...baseColumns(),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 128 }),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    practiceIdx: index("treatment_templates_practice_idx").on(
      table.practiceId,
      table.deletedAt
    ),
  })
);

export const treatmentTemplateItems = pgTable(
  "treatment_template_items",
  {
    ...baseColumns(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => treatmentTemplates.id),
    itemType: invoiceItemTypeEnum("item_type").notNull(),
    itemId: uuid("item_id"),
    description: varchar("description", { length: 500 }).notNull(),
    defaultQuantity: integer("default_quantity").notNull().default(1),
    defaultUnitPrice: numeric("default_unit_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    templateIdx: index("treatment_template_items_template_idx").on(
      table.templateId,
      table.deletedAt
    ),
  })
);

// Relations
export const treatmentTemplatesRelations = relations(
  treatmentTemplates,
  ({ one, many }) => ({
    practice: one(practices, {
      fields: [treatmentTemplates.practiceId],
      references: [practices.id],
    }),
    items: many(treatmentTemplateItems),
  })
);

export const treatmentTemplateItemsRelations = relations(
  treatmentTemplateItems,
  ({ one }) => ({
    template: one(treatmentTemplates, {
      fields: [treatmentTemplateItems.templateId],
      references: [treatmentTemplates.id],
    }),
  })
);
