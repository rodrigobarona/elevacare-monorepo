-- Phase 06.2: payout engine, refunds, transfer reversals, DLQ.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

DO $$ BEGIN
  CREATE TYPE "payout_status" AS ENUM (
    'pending',
    'scheduled',
    'approval_required',
    'transferred',
    'paid_out',
    'failed',
    'held',
    'reversal_pending',
    'reversed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "payout_hold_reason" AS ENUM ('dispute', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "booking_refund_status" AS ENUM ('pending', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "transfer_reversal_status" AS ENUM ('pending', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "workflow_dead_letter_status" AS ENUM ('open', 'replayed', 'discarded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN IF NOT EXISTS "dispute_status" varchar(16) NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "booking_payments_dispute_status";
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_dispute_status"
  CHECK (dispute_status IN ('none','open','won','lost'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "booking_payment_id" uuid NOT NULL REFERENCES "booking_payments"("id") ON DELETE RESTRICT,
  "expert_org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "destination_org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "destination_connect_account_id" varchar(255) NOT NULL,
  "status" "payout_status" NOT NULL DEFAULT 'pending',
  "amount_cents" integer NOT NULL,
  "reversed_cents" integer NOT NULL DEFAULT 0,
  "eligible_at" timestamp with time zone NOT NULL,
  "scheduled_for" timestamp with time zone,
  "transfer_idempotency_key" uuid NOT NULL DEFAULT gen_random_uuid(),
  "stripe_transfer_id" varchar(255),
  "stripe_payout_id" varchar(255),
  "hold_reasons" text[] NOT NULL DEFAULT '{}',
  "held_from_status" "payout_status",
  "approved_by" uuid REFERENCES "auth"."user"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_states_booking_payment_id_key" ON "payout_states" ("booking_payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_states_transfer_idempotency_key" ON "payout_states" ("transfer_idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_states_org_idx" ON "payout_states" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_states_status_idx" ON "payout_states" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_states_destination_idx" ON "payout_states" ("destination_connect_account_id");
--> statement-breakpoint
ALTER TABLE "payout_states" DROP CONSTRAINT IF EXISTS "payout_states_amount";
--> statement-breakpoint
ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_amount" CHECK (amount_cents >= 0);
--> statement-breakpoint
ALTER TABLE "payout_states" DROP CONSTRAINT IF EXISTS "payout_states_reversed_cents";
--> statement-breakpoint
ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_reversed_cents"
  CHECK (reversed_cents >= 0 AND reversed_cents <= amount_cents);
--> statement-breakpoint
ALTER TABLE "payout_states" DROP CONSTRAINT IF EXISTS "payout_states_hold_reasons";
--> statement-breakpoint
ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_hold_reasons"
  CHECK (hold_reasons <@ ARRAY['dispute','manual']::text[]);
--> statement-breakpoint
ALTER TABLE "payout_states" DROP CONSTRAINT IF EXISTS "payout_states_expert_org";
--> statement-breakpoint
ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_expert_org"
  CHECK (org_id = expert_org_id);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_id_org_key" UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_id_org_key" UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_id_payment_key" UNIQUE ("id", "booking_payment_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "payout_states" DROP CONSTRAINT IF EXISTS "payout_states_payment_org_fk";
--> statement-breakpoint
ALTER TABLE "payout_states" ADD CONSTRAINT "payout_states_payment_org_fk"
  FOREIGN KEY ("booking_payment_id", "org_id") REFERENCES "booking_payments" ("id", "org_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION payout_states_forbid_destination_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.destination_org_id IS DISTINCT FROM OLD.destination_org_id
     OR NEW.destination_connect_account_id IS DISTINCT FROM OLD.destination_connect_account_id THEN
    RAISE EXCEPTION 'payout_states destination snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS payout_states_immutable_destination ON "payout_states";
--> statement-breakpoint
CREATE TRIGGER payout_states_immutable_destination
  BEFORE UPDATE ON "payout_states"
  FOR EACH ROW
  EXECUTE FUNCTION payout_states_forbid_destination_update();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_refunds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "booking_payment_id" uuid NOT NULL REFERENCES "booking_payments"("id") ON DELETE RESTRICT,
  "stripe_refund_id" varchar(255),
  "amount_cents" integer NOT NULL,
  "status" "booking_refund_status" NOT NULL DEFAULT 'pending',
  "reason" text NOT NULL,
  "refund_seq" integer NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_refunds_payment_seq_key" ON "booking_refunds" ("booking_payment_id", "refund_seq");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_refunds_idempotency_key" ON "booking_refunds" ("idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_refunds_stripe_refund_id_key"
  ON "booking_refunds" ("stripe_refund_id")
  WHERE "stripe_refund_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_refunds_org_idx" ON "booking_refunds" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_refunds_payment_idx" ON "booking_refunds" ("booking_payment_id");
--> statement-breakpoint
ALTER TABLE "booking_refunds" DROP CONSTRAINT IF EXISTS "booking_refunds_amount";
--> statement-breakpoint
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_amount" CHECK (amount_cents > 0);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_id_org_key" UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_id_payment_key" UNIQUE ("id", "booking_payment_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "booking_refunds" DROP CONSTRAINT IF EXISTS "booking_refunds_payment_org_fk";
--> statement-breakpoint
ALTER TABLE "booking_refunds" ADD CONSTRAINT "booking_refunds_payment_org_fk"
  FOREIGN KEY ("booking_payment_id", "org_id") REFERENCES "booking_payments" ("id", "org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfer_reversals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "payout_state_id" uuid NOT NULL REFERENCES "payout_states"("id") ON DELETE RESTRICT,
  "refund_id" uuid NOT NULL REFERENCES "booking_refunds"("id") ON DELETE RESTRICT,
  "booking_payment_id" uuid NOT NULL,
  "stripe_reversal_id" varchar(255),
  "amount_cents" integer NOT NULL,
  "status" "transfer_reversal_status" NOT NULL DEFAULT 'pending',
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_reversals_refund_id_key" ON "transfer_reversals" ("refund_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_reversals_org_idx" ON "transfer_reversals" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_reversals_payout_idx" ON "transfer_reversals" ("payout_state_id");
--> statement-breakpoint
ALTER TABLE "transfer_reversals" DROP CONSTRAINT IF EXISTS "transfer_reversals_amount";
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ADD CONSTRAINT "transfer_reversals_amount" CHECK (amount_cents >= 0);
--> statement-breakpoint
ALTER TABLE "transfer_reversals" DROP CONSTRAINT IF EXISTS "transfer_reversals_payout_org_fk";
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ADD CONSTRAINT "transfer_reversals_payout_org_fk"
  FOREIGN KEY ("payout_state_id", "org_id") REFERENCES "payout_states" ("id", "org_id");
--> statement-breakpoint
ALTER TABLE "transfer_reversals" DROP CONSTRAINT IF EXISTS "transfer_reversals_refund_org_fk";
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ADD CONSTRAINT "transfer_reversals_refund_org_fk"
  FOREIGN KEY ("refund_id", "org_id") REFERENCES "booking_refunds" ("id", "org_id");
--> statement-breakpoint
ALTER TABLE "transfer_reversals" DROP CONSTRAINT IF EXISTS "transfer_reversals_payout_payment_fk";
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ADD CONSTRAINT "transfer_reversals_payout_payment_fk"
  FOREIGN KEY ("payout_state_id", "booking_payment_id") REFERENCES "payout_states" ("id", "booking_payment_id");
--> statement-breakpoint
ALTER TABLE "transfer_reversals" DROP CONSTRAINT IF EXISTS "transfer_reversals_refund_payment_fk";
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ADD CONSTRAINT "transfer_reversals_refund_payment_fk"
  FOREIGN KEY ("refund_id", "booking_payment_id") REFERENCES "booking_refunds" ("id", "booking_payment_id");
--> statement-breakpoint
-- workflow_dead_letters is platform/service-scoped (admin or stripe_webhook /
-- audit_drainer). org_id is informational for ops; RLS does not use eleva.org_id.
CREATE TABLE IF NOT EXISTS "workflow_dead_letters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid REFERENCES "auth"."organization"("id") ON DELETE SET NULL,
  "workflow_name" varchar(128) NOT NULL,
  "entity_id" uuid,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" "workflow_dead_letter_status" NOT NULL DEFAULT 'open',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_dead_letters_workflow_idx" ON "workflow_dead_letters" ("workflow_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_dead_letters_status_idx" ON "workflow_dead_letters" ("status");
--> statement-breakpoint
ALTER TABLE "payout_states" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payout_states" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS payout_states_tenant_isolation ON "payout_states";
--> statement-breakpoint
CREATE POLICY payout_states_tenant_isolation ON "payout_states"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
ALTER TABLE "booking_refunds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_refunds" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS booking_refunds_tenant_isolation ON "booking_refunds";
--> statement-breakpoint
CREATE POLICY booking_refunds_tenant_isolation ON "booking_refunds"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
ALTER TABLE "transfer_reversals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "transfer_reversals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS transfer_reversals_tenant_isolation ON "transfer_reversals";
--> statement-breakpoint
CREATE POLICY transfer_reversals_tenant_isolation ON "transfer_reversals"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
ALTER TABLE "workflow_dead_letters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_dead_letters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS workflow_dead_letters_tenant_isolation ON "workflow_dead_letters";
--> statement-breakpoint
CREATE POLICY workflow_dead_letters_tenant_isolation ON "workflow_dead_letters"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) IN ('stripe_webhook', 'audit_drainer')
  );
