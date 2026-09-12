-- Phase 06.1: Connect status on billing_customers + settlement columns
-- on booking_payments. Statements are idempotent so a mid-file retry
-- on a Neon preview branch can finish.

ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "payouts_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "details_submitted" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "requirements_currently_due" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "connect_capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "identity_status" varchar(32);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "commission_override_bps" integer;
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD COLUMN IF NOT EXISTS "commission_override_expires_at" timestamp with time zone;
--> statement-breakpoint
DROP INDEX IF EXISTS "billing_customers_connect_account_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_customers_connect_account_idx"
  ON "billing_customers" ("stripe_connect_account_id");
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "applied_commission_bps" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "platform_fee_net_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "platform_fee_vat_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "processing_fee_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_commission_bps";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_commission_bps"
  CHECK (applied_commission_bps >= 0);
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_platform_fee_net";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_platform_fee_net"
  CHECK (platform_fee_net_cents >= 0);
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_platform_fee_vat";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_platform_fee_vat"
  CHECK (platform_fee_vat_cents >= 0);
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_processing_fee";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_processing_fee"
  CHECK (processing_fee_cents >= 0);
--> statement-breakpoint
-- Pre-06.1 rows had application_fee_cents only. Copy that fee as net
-- (VAT unknown until Phase 7) so DEFAULT 0 is not left on live-looking
-- demo bookings. Pre-launch: no production ledger to reconcile.
UPDATE "booking_payments"
SET
  "applied_commission_bps" = CASE
    WHEN "amount_cents" > 0
    THEN ROUND(("application_fee_cents"::numeric * 10000) / "amount_cents")::integer
    ELSE 0
  END,
  "platform_fee_net_cents" = "application_fee_cents",
  "platform_fee_vat_cents" = 0,
  "processing_fee_cents" = 0
WHERE "application_fee_cents" > 0
  AND "applied_commission_bps" = 0;
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_platform_fee_split";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_platform_fee_split"
  CHECK (application_fee_cents = platform_fee_net_cents + platform_fee_vat_cents);
--> statement-breakpoint
ALTER TABLE "billing_customers" DROP CONSTRAINT IF EXISTS "billing_customers_commission_override_bps";
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_commission_override_bps"
  CHECK (commission_override_bps IS NULL OR (commission_override_bps >= 0 AND commission_override_bps <= 10000));
