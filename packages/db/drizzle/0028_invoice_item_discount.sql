-- Allow prompt-payment (and similar) discount lines on invoices.
ALTER TYPE "public"."invoice_item_type" ADD VALUE IF NOT EXISTS 'discount';
