-- Closed-gate 07.1 outcomes: v1 POST blocked, IVA/queue skipped.
-- Does not POST TOConline documents.
-- Insert before dead_lettered so the DB enum order matches the schema.

ALTER TYPE "public"."platform_fee_invoice_status" ADD VALUE IF NOT EXISTS 'blocked' BEFORE 'dead_lettered';
--> statement-breakpoint
ALTER TYPE "public"."platform_fee_invoice_status" ADD VALUE IF NOT EXISTS 'skipped' BEFORE 'dead_lettered';
