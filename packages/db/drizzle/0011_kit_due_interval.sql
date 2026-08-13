ALTER TABLE "inventory_kits" ADD COLUMN "due_interval_value" integer;--> statement-breakpoint
ALTER TABLE "inventory_kits" ADD COLUMN "due_interval_unit" varchar(16);
