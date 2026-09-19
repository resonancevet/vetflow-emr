CREATE TABLE "practice_client_sequences" (
	"practice_id" uuid PRIMARY KEY NOT NULL,
	"next_seq" integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
ALTER TABLE "practice_client_sequences" ADD CONSTRAINT "practice_client_sequences_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "display_id" varchar(32);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "display_id" varchar(32);--> statement-breakpoint
CREATE INDEX "clients_display_id_idx" ON "clients" USING btree ("practice_id","display_id");--> statement-breakpoint
CREATE INDEX "patients_display_id_idx" ON "patients" USING btree ("practice_id","display_id");--> statement-breakpoint
-- Backfill client display IDs per practice (oldest first)
DO $$
DECLARE
  r RECORD;
  seq integer;
BEGIN
  FOR r IN SELECT DISTINCT practice_id FROM clients WHERE deleted_at IS NULL
  LOOP
    seq := 0;
    UPDATE clients c
    SET display_id = sub.display_id
    FROM (
      SELECT
        id,
        'C' || lpad((row_number() OVER (ORDER BY created_at ASC, id ASC))::text, 4, '0') AS display_id,
        row_number() OVER (ORDER BY created_at ASC, id ASC) AS n
      FROM clients
      WHERE practice_id = r.practice_id AND deleted_at IS NULL
    ) sub
    WHERE c.id = sub.id;

    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(display_id, '^C0*', ''), '')::integer
    ), 0) INTO seq
    FROM clients
    WHERE practice_id = r.practice_id AND display_id IS NOT NULL;

    INSERT INTO practice_client_sequences (practice_id, next_seq)
    VALUES (r.practice_id, seq + 1)
    ON CONFLICT (practice_id) DO UPDATE SET next_seq = EXCLUDED.next_seq;
  END LOOP;
END $$;--> statement-breakpoint
-- Backfill patient display IDs from parent client sequence
DO $$
BEGIN
  UPDATE patients p
  SET display_id = sub.display_id
  FROM (
    SELECT
      p2.id,
      'P' || lpad(
        COALESCE(
          NULLIF(regexp_replace(c.display_id, '^C0*', ''), '')::integer,
          0
        )::text,
        4,
        '0'
      ) || '-' || lpad(
        (row_number() OVER (
          PARTITION BY p2.client_id
          ORDER BY p2.created_at ASC, p2.id ASC
        ))::text,
        2,
        '0'
      ) AS display_id
    FROM patients p2
    INNER JOIN clients c ON c.id = p2.client_id
    WHERE p2.deleted_at IS NULL AND c.display_id IS NOT NULL
  ) sub
  WHERE p.id = sub.id;
END $$;
