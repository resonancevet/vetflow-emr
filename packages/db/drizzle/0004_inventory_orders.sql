CREATE TYPE "public"."inventory_order_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."inventory_completion_status" AS ENUM('complete', 'incomplete', 'not_received');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_name" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "units" varchar(32);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "products" SET "needs_review" = true WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE TABLE "inventory_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"supplier_id" uuid,
	"supplier_name" varchar(255),
	"date_ordered" date NOT NULL,
	"date_received" date,
	"status" "inventory_order_status" DEFAULT 'active' NOT NULL,
	"completion_status" "inventory_completion_status" DEFAULT 'not_received' NOT NULL,
	"archived_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "inventory_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"order_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(64),
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"csv_total_price" numeric(10, 2),
	"total_mismatch" boolean DEFAULT false NOT NULL,
	"date_ordered" date NOT NULL,
	"is_received" boolean DEFAULT false NOT NULL,
	"date_received" date,
	"category" varchar(128),
	"qty_received" integer,
	"count" integer,
	"units" varchar(32),
	"cost_per_count" numeric(10, 4),
	"reorder_point" integer,
	"lot_number" varchar(64),
	"expiration_date" date,
	"product_id" uuid,
	"stock_posted" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
ALTER TABLE "inventory_orders" ADD CONSTRAINT "inventory_orders_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_orders" ADD CONSTRAINT "inventory_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_order_items" ADD CONSTRAINT "inventory_order_items_order_id_inventory_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."inventory_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_order_items" ADD CONSTRAINT "inventory_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_orders_practice_status_idx" ON "inventory_orders" USING btree ("practice_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "inventory_order_items_order_idx" ON "inventory_order_items" USING btree ("order_id");
