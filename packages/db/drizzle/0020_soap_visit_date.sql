ALTER TABLE "soap_notes" ADD COLUMN IF NOT EXISTS "visit_date" date;
UPDATE "soap_notes"
SET "visit_date" = (("created_at" AT TIME ZONE 'UTC')::date)
WHERE "visit_date" IS NULL;
ALTER TABLE "soap_notes" ALTER COLUMN "visit_date" SET DEFAULT CURRENT_DATE;
ALTER TABLE "soap_notes" ALTER COLUMN "visit_date" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "soap_notes_visit_date_idx" ON "soap_notes" ("patient_id","visit_date");
