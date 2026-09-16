CREATE TYPE "public"."package_billing_mode" AS ENUM('pay_in_full', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."package_sale_status" AS ENUM('active', 'past_due', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."package_installment_status" AS ENUM('scheduled', 'invoiced', 'paid', 'waived', 'void');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE IF NOT EXISTS 'venmo';--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price_total" numeric(10, 2) NOT NULL,
	"installment_count" integer DEFAULT 12 NOT NULL,
	"allow_pay_in_full" boolean DEFAULT true NOT NULL,
	"allow_monthly" boolean DEFAULT true NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"package_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "service_package_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"practice_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"patient_id" uuid,
	"billing_mode" "package_billing_mode" NOT NULL,
	"status" "package_sale_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"contract_total" numeric(10, 2) NOT NULL,
	"package_name" varchar(255) NOT NULL,
	"enrolled_by" uuid,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text
);--> statement-breakpoint
CREATE TABLE "service_package_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"sale_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "package_installment_status" DEFAULT 'scheduled' NOT NULL,
	"invoice_id" uuid,
	"generated_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_sales" ADD CONSTRAINT "service_package_sales_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_sales" ADD CONSTRAINT "service_package_sales_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_sales" ADD CONSTRAINT "service_package_sales_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_sales" ADD CONSTRAINT "service_package_sales_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_sales" ADD CONSTRAINT "service_package_sales_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_installments" ADD CONSTRAINT "service_package_installments_sale_id_service_package_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."service_package_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_installments" ADD CONSTRAINT "service_package_installments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_packages_practice_idx" ON "service_packages" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "service_package_items_package_idx" ON "service_package_items" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "service_package_sales_practice_idx" ON "service_package_sales" USING btree ("practice_id","deleted_at");--> statement-breakpoint
CREATE INDEX "service_package_sales_client_idx" ON "service_package_sales" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "service_package_installments_sale_idx" ON "service_package_installments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "service_package_installments_due_idx" ON "service_package_installments" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "service_package_installments_invoice_uniq" ON "service_package_installments" USING btree ("invoice_id");
