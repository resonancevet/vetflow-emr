CREATE TABLE IF NOT EXISTS "staff_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "practice_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "notes" text,
  "due_at" timestamp with time zone NOT NULL,
  "client_id" uuid,
  "patient_id" uuid,
  "appointment_id" uuid,
  "created_by" uuid NOT NULL,
  "completed_at" timestamp with time zone,
  "completed_by" uuid
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_reminders" ADD CONSTRAINT "staff_reminders_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_reminders_practice_due_idx" ON "staff_reminders" USING btree ("practice_id","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_reminders_patient_idx" ON "staff_reminders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_reminders_client_idx" ON "staff_reminders" USING btree ("client_id");
