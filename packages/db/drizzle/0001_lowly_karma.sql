ALTER TABLE "practices" ADD COLUMN "schedule_start_hour" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "schedule_end_hour" integer DEFAULT 18 NOT NULL;