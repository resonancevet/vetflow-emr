ALTER TABLE "inventory_kits" ADD COLUMN "is_combo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_kits" ADD COLUMN "reminder_protocols" jsonb DEFAULT '[]'::jsonb NOT NULL;
