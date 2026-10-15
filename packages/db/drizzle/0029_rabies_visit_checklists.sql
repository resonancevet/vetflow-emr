ALTER TABLE "vaccination_records" ADD COLUMN IF NOT EXISTS "lot_expiration" date;--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN IF NOT EXISTS "administration_site" varchar(64);--> statement-breakpoint
ALTER TABLE "vaccination_records" ADD COLUMN IF NOT EXISTS "certificate_file_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "rabies_planned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."visit_checklist_kind" AS ENUM('rabies');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."visit_checklist_phase" AS ENUM('pre', 'post');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."visit_checklist_status" AS ENUM('open', 'complete');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visit_checklists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "practice_id" uuid NOT NULL REFERENCES "practices"("id"),
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id"),
  "patient_id" uuid NOT NULL REFERENCES "patients"("id"),
  "kind" "visit_checklist_kind" DEFAULT 'rabies' NOT NULL,
  "status" "visit_checklist_status" DEFAULT 'open' NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visit_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "checklist_id" uuid NOT NULL REFERENCES "visit_checklists"("id"),
  "phase" "visit_checklist_phase" NOT NULL,
  "key" varchar(64) NOT NULL,
  "label" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "auto_completable" boolean DEFAULT false NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid REFERENCES "users"("id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_checklists_practice_idx" ON "visit_checklists" ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_checklists_appointment_idx" ON "visit_checklists" ("appointment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_checklists_patient_idx" ON "visit_checklists" ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visit_checklists_appointment_kind_uniq" ON "visit_checklists" ("appointment_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_checklist_items_checklist_idx" ON "visit_checklist_items" ("checklist_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visit_checklist_items_checklist_key_uniq" ON "visit_checklist_items" ("checklist_id","key");
