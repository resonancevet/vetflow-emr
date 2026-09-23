CREATE TABLE "practice_invoice_sequences" (
	"practice_id" uuid PRIMARY KEY NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
ALTER TABLE "practice_invoice_sequences" ADD CONSTRAINT "practice_invoice_sequences_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_number" integer;--> statement-breakpoint
CREATE INDEX "invoices_practice_number_idx" ON "invoices" USING btree ("practice_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_practice_number_uniq" ON "invoices" USING btree ("practice_id","invoice_number") WHERE "invoice_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
-- Backfill sequential numbers for existing non-template invoices (estimates included if they are client invoices).
WITH ranked AS (
  SELECT
    id,
    practice_id,
    row_number() OVER (
      PARTITION BY practice_id
      ORDER BY created_at ASC, id ASC
    ) AS seq
  FROM invoices
  WHERE deleted_at IS NULL
    AND is_template = false
    AND is_estimate = false
)
UPDATE invoices i
SET invoice_number = ranked.seq
FROM ranked
WHERE i.id = ranked.id;--> statement-breakpoint
INSERT INTO practice_invoice_sequences (practice_id, next_seq)
SELECT practice_id, coalesce(max(invoice_number), 0) + 1
FROM invoices
WHERE invoice_number IS NOT NULL
GROUP BY practice_id
ON CONFLICT (practice_id) DO UPDATE
SET next_seq = GREATEST(practice_invoice_sequences.next_seq, EXCLUDED.next_seq);
