CREATE TYPE "public"."stock_movement_type" AS ENUM('receive', 'reverse_receive', 'use', 'invoice', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."inventory_usage_source" AS ENUM('vaccination', 'prescription', 'administration', 'supply');--> statement-breakpoint
CREATE TABLE "inventory_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"source_type" "inventory_usage_source" NOT NULL,
	"source_id" uuid,
	"note" text,
	"invoice_item_id" uuid,
	"created_by" uuid
);--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"note" text,
	"created_by" uuid,
	"order_item_id" uuid,
	"usage_id" uuid,
	"invoice_item_id" uuid
);--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_usages" ADD CONSTRAINT "inventory_usages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_item_id_inventory_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."inventory_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_usage_id_inventory_usages_id_fk" FOREIGN KEY ("usage_id") REFERENCES "public"."inventory_usages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_usages_patient_idx" ON "inventory_usages" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "inventory_usages_practice_idx" ON "inventory_usages" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "inventory_usages_unbilled_idx" ON "inventory_usages" USING btree ("practice_id","invoice_item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_practice_idx" ON "stock_movements" USING btree ("practice_id","created_at");
