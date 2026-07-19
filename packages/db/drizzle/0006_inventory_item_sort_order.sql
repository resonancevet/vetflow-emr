ALTER TABLE "inventory_order_items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY order_id
      ORDER BY created_at ASC, id ASC
    ) - 1)::integer AS rn
  FROM inventory_order_items
  WHERE deleted_at IS NULL
)
UPDATE inventory_order_items AS i
SET sort_order = ranked.rn
FROM ranked
WHERE i.id = ranked.id;
