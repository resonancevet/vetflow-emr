-- Allow kit lines to be inventory products or billable services (e.g. outside lab fee).
ALTER TABLE "inventory_kit_items" ADD COLUMN "item_type" varchar(16) DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ADD CONSTRAINT "inventory_kit_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ADD CONSTRAINT "inventory_kit_items_item_ref_check" CHECK (
  ("item_type" = 'product' AND "product_id" IS NOT NULL AND "service_id" IS NULL)
  OR ("item_type" = 'service' AND "service_id" IS NOT NULL AND "product_id" IS NULL)
);--> statement-breakpoint
CREATE INDEX "inventory_kit_items_service_idx" ON "inventory_kit_items" USING btree ("service_id");
