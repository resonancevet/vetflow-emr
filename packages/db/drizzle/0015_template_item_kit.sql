ALTER TABLE "treatment_template_items" ALTER COLUMN "item_type" SET DATA TYPE varchar(16) USING "item_type"::text;
