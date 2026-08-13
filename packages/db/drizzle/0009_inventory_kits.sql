CREATE TABLE "inventory_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
CREATE TABLE "inventory_kit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"kit_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text
);--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN "kit_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_kits" ADD CONSTRAINT "inventory_kits_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ADD CONSTRAINT "inventory_kit_items_kit_id_inventory_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."inventory_kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_kit_items" ADD CONSTRAINT "inventory_kit_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD CONSTRAINT "vaccination_records_kit_id_inventory_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."inventory_kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_kits_practice_idx" ON "inventory_kits" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "inventory_kit_items_kit_idx" ON "inventory_kit_items" USING btree ("kit_id","deleted_at");
