ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "intake_history" jsonb;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."intake_signature_method" AS ENUM('typed', 'drawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."intake_signature_section" AS ENUM('agreement', 'media', 'registration');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"appointment_id" uuid,
	"invited_by" uuid,
	CONSTRAINT "intake_invites_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"invite_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"agreement_version" varchar(64) NOT NULL,
	"media_consent" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"submission_id" uuid NOT NULL,
	"section" "intake_signature_section" NOT NULL,
	"method" "intake_signature_method" NOT NULL,
	"typed_name" varchar(255),
	"signature_data" text,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_invites" ADD CONSTRAINT "intake_invites_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_invites" ADD CONSTRAINT "intake_invites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_invites" ADD CONSTRAINT "intake_invites_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_invites" ADD CONSTRAINT "intake_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_invite_id_intake_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."intake_invites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intake_signatures" ADD CONSTRAINT "intake_signatures_submission_id_intake_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."intake_submissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_invites_client_idx" ON "intake_invites" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_invites_practice_idx" ON "intake_invites" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_invites_expires_idx" ON "intake_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_submissions_client_idx" ON "intake_submissions" USING btree ("client_id","submitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_submissions_practice_idx" ON "intake_submissions" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_submissions_invite_idx" ON "intake_submissions" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_signatures_submission_idx" ON "intake_signatures" USING btree ("submission_id");
