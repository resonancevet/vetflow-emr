-- Allow kit on legacy enum-backed columns, then keep template items as varchar.
ALTER TYPE "public"."invoice_item_type" ADD VALUE IF NOT EXISTS 'kit';--> statement-breakpoint
ALTER TABLE "treatment_template_items" ALTER COLUMN "item_type" SET DATA TYPE varchar(16) USING "item_type"::text;
