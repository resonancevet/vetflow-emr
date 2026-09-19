ALTER TABLE "inventory_kits" ADD COLUMN "reminder_due_intervals" jsonb DEFAULT '{}'::jsonb NOT NULL;
