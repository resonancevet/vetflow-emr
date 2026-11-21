ALTER TABLE "communications" ADD COLUMN IF NOT EXISTS "occurred_at" timestamp with time zone;--> statement-breakpoint
UPDATE "communications" SET "occurred_at" = "created_at" WHERE "occurred_at" IS NULL;--> statement-breakpoint
ALTER TABLE "communications" ALTER COLUMN "occurred_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "communications" ALTER COLUMN "occurred_at" SET NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "communications_patient_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "communications_client_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communications_patient_idx" ON "communications" USING btree ("patient_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communications_client_idx" ON "communications" USING btree ("client_id","occurred_at");
