ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "discount_kind" varchar(32);--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "linked_item_id" uuid;
