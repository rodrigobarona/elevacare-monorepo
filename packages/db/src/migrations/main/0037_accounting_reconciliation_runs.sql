-- Phase 07.2: monthly Stripe vs expert_invoices reconciliation log.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.
-- Does not create TOConline documents.

DO $$ BEGIN
  CREATE TYPE "accounting_reconciliation_status" AS ENUM (
    'matched',
    'mismatch'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_reconciliation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "month" varchar(7) NOT NULL,
  "stripe_fee_total_cents" integer NOT NULL,
  "invoiced_total_cents" integer NOT NULL,
  "mismatch_bps" integer NOT NULL,
  "status" "accounting_reconciliation_status" NOT NULL,
  "details" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  DROP CONSTRAINT IF EXISTS "accounting_reconciliation_runs_month_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounting_reconciliation_runs"
    ADD CONSTRAINT "accounting_reconciliation_runs_month_key" UNIQUE ("month");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  DROP CONSTRAINT IF EXISTS "accounting_reconciliation_runs_month";
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  ADD CONSTRAINT "accounting_reconciliation_runs_month"
  CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  DROP CONSTRAINT IF EXISTS "accounting_reconciliation_runs_fee";
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  ADD CONSTRAINT "accounting_reconciliation_runs_fee"
  CHECK (stripe_fee_total_cents >= 0);
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  DROP CONSTRAINT IF EXISTS "accounting_reconciliation_runs_invoiced";
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  ADD CONSTRAINT "accounting_reconciliation_runs_invoiced"
  CHECK (invoiced_total_cents >= 0);
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  DROP CONSTRAINT IF EXISTS "accounting_reconciliation_runs_mismatch";
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs"
  ADD CONSTRAINT "accounting_reconciliation_runs_mismatch"
  CHECK (mismatch_bps >= 0);
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "accounting_reconciliation_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS accounting_reconciliation_runs_service_only
  ON "accounting_reconciliation_runs";
--> statement-breakpoint
CREATE POLICY accounting_reconciliation_runs_service_only
  ON "accounting_reconciliation_runs"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')
  );
