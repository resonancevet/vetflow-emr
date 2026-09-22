CREATE TYPE "public"."quickbooks_entity_type" AS ENUM('customer', 'invoice', 'payment');--> statement-breakpoint
CREATE TABLE "quickbooks_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"realm_id" varchar(64) NOT NULL,
	"company_name" varchar(255),
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"income_account_id" varchar(64),
	"deposit_account_id" varchar(64),
	"default_item_id" varchar(64),
	"last_sync_at" timestamp with time zone,
	"last_error" text
);--> statement-breakpoint
CREATE TABLE "quickbooks_entity_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"entity_type" "quickbooks_entity_type" NOT NULL,
	"local_id" uuid NOT NULL,
	"qbo_id" varchar(64) NOT NULL
);--> statement-breakpoint
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_entity_links" ADD CONSTRAINT "quickbooks_entity_links_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_connections_practice_uniq" ON "quickbooks_connections" USING btree ("practice_id");--> statement-breakpoint
CREATE INDEX "quickbooks_connections_realm_idx" ON "quickbooks_connections" USING btree ("realm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quickbooks_entity_links_local_uniq" ON "quickbooks_entity_links" USING btree ("practice_id","entity_type","local_id");
