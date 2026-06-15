CREATE TYPE "public"."exam_status" AS ENUM('wnl', 'abnormal', 'not_examined');--> statement-breakpoint
CREATE TYPE "public"."consent_decision" AS ENUM('consented', 'declined');--> statement-breakpoint
CREATE TYPE "public"."procedure_type" AS ENUM('general', 'surgery', 'dental', 'other');--> statement-breakpoint
CREATE TYPE "public"."administration_route" AS ENUM('oral', 'topical', 'subcutaneous', 'intramuscular', 'intravenous', 'other');--> statement-breakpoint
CREATE TYPE "public"."prescription_route" AS ENUM('oral', 'topical', 'subcutaneous', 'intramuscular', 'intravenous', 'other');--> statement-breakpoint
ALTER TABLE "soap_notes" ADD COLUMN "diagnosis" varchar(500);--> statement-breakpoint
ALTER TABLE "soap_notes" ADD COLUMN "prognosis" text;--> statement-breakpoint
ALTER TABLE "soap_notes" ADD COLUMN "reason_for_visit" varchar(500);--> statement-breakpoint
ALTER TABLE "soap_notes" ADD COLUMN "auto_finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "procedures" ADD COLUMN "procedure_type" "procedure_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "route" "prescription_route";--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "response_to_treatment" text;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD COLUMN "administered_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "exam_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"soap_note_id" uuid,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight_kg" numeric(8, 3),
	"temperature_f" numeric(5, 2),
	"heart_rate" integer,
	"respiratory_rate" integer,
	"exam_status" "exam_status" DEFAULT 'wnl' NOT NULL,
	"exam_notes" text
);
--> statement-breakpoint
CREATE TABLE "client_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"appointment_id" uuid,
	"author_id" uuid NOT NULL,
	"recommendation" text NOT NULL,
	"decision" "consent_decision" NOT NULL,
	"risks" text,
	"benefits" text,
	"estimated_cost" varchar(128),
	"notes" text,
	"documented_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discharge_instructions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"author_id" uuid NOT NULL,
	"visit_date" date NOT NULL,
	"diagnosis" text,
	"doctor_name" varchar(255),
	"medications" jsonb,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"follow_up_date" date,
	"follow_up_notes" text,
	"restrictions" jsonb,
	"emergency_notes" text,
	"pdf_file_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_administrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"administered_by" uuid NOT NULL,
	"medication_name" varchar(255) NOT NULL,
	"dosage" varchar(128),
	"route" "administration_route",
	"administered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_to_treatment" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "patient_custody" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"custody_start" timestamp with time zone NOT NULL,
	"custody_end" timestamp with time zone,
	"reason" varchar(255),
	"notes" text,
	"recorded_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anesthesia_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"procedure_id" uuid,
	"recorded_by" uuid NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"protocol" text,
	"vital_signs_log" text,
	"complications" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "procedure_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"procedure_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(128)
);
--> statement-breakpoint
ALTER TABLE "exam_vitals" ADD CONSTRAINT "exam_vitals_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_vitals" ADD CONSTRAINT "exam_vitals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_vitals" ADD CONSTRAINT "exam_vitals_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_vitals" ADD CONSTRAINT "exam_vitals_soap_note_id_soap_notes_id_fk" FOREIGN KEY ("soap_note_id") REFERENCES "public"."soap_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_vitals" ADD CONSTRAINT "exam_vitals_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_consents" ADD CONSTRAINT "client_consents_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_instructions" ADD CONSTRAINT "discharge_instructions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_instructions" ADD CONSTRAINT "discharge_instructions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_instructions" ADD CONSTRAINT "discharge_instructions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_instructions" ADD CONSTRAINT "discharge_instructions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discharge_instructions" ADD CONSTRAINT "discharge_instructions_pdf_file_id_files_id_fk" FOREIGN KEY ("pdf_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_administrations" ADD CONSTRAINT "treatment_administrations_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_administrations" ADD CONSTRAINT "treatment_administrations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_administrations" ADD CONSTRAINT "treatment_administrations_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_administrations" ADD CONSTRAINT "treatment_administrations_administered_by_users_id_fk" FOREIGN KEY ("administered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_custody" ADD CONSTRAINT "patient_custody_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_custody" ADD CONSTRAINT "patient_custody_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_custody" ADD CONSTRAINT "patient_custody_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_custody" ADD CONSTRAINT "patient_custody_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anesthesia_records" ADD CONSTRAINT "anesthesia_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_team_members" ADD CONSTRAINT "procedure_team_members_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_team_members" ADD CONSTRAINT "procedure_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_vitals_patient_idx" ON "exam_vitals" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "exam_vitals_practice_idx" ON "exam_vitals" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "client_consents_patient_idx" ON "client_consents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "client_consents_practice_idx" ON "client_consents" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "discharge_instructions_patient_idx" ON "discharge_instructions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "discharge_instructions_practice_idx" ON "discharge_instructions" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "treatment_admin_patient_idx" ON "treatment_administrations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "treatment_admin_practice_idx" ON "treatment_administrations" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "patient_custody_patient_idx" ON "patient_custody" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patient_custody_practice_idx" ON "patient_custody" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "anesthesia_records_patient_idx" ON "anesthesia_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "anesthesia_records_practice_idx" ON "anesthesia_records" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "procedure_team_procedure_idx" ON "procedure_team_members" USING btree ("procedure_id");
