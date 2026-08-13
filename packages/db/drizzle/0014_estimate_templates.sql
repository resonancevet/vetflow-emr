ALTER TABLE "invoices" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;
