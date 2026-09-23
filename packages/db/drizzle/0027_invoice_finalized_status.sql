-- Add finalized status between draft workflow and client delivery.
ALTER TYPE "public"."invoice_status" ADD VALUE IF NOT EXISTS 'finalized' AFTER 'draft';
