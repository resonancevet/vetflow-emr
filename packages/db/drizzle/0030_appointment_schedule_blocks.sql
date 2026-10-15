ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "is_block" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "title" varchar(255);
