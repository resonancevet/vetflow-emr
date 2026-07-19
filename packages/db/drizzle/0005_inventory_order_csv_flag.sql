ALTER TABLE "inventory_orders" ADD COLUMN "imported_from_csv" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "inventory_orders" SET "imported_from_csv" = true
WHERE EXISTS (
  SELECT 1 FROM "inventory_order_items"
  WHERE "inventory_order_items"."order_id" = "inventory_orders"."id"
    AND "inventory_order_items"."csv_total_price" IS NOT NULL
    AND "inventory_order_items"."deleted_at" IS NULL
);
