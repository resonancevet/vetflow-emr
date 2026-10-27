ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_at" timestamp with time zone;
