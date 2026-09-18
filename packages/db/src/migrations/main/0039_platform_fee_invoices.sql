-- Phase 07.1: platform_fee_invoices, credit notes, clinic SaaS invoices.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.
-- Does not POST TOConline documents.

DO $$ BEGIN
  CREATE TYPE "platform_fee_invoice_status" AS ENUM (
    'pending',
    'issued',
    'failed',
    'dead_lettered',
    'credited',
    'legacy',
    'legacy_missing'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "platform_fee_iva_regime" AS ENUM (
    'pending',
    'pt_territorial',
    'eu_reverse_charge',
    'eu_unclassified',
    'extra_eu_unclassified',
    'vies_unavailable'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "platform_fee_at_status" AS ENUM (
    'operator_gated',
    'not_applicable',
    'communicated',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "platform_fee_credit_note_status" AS ENUM (
    'pending',
    'issued',
    'failed',
    'blocked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "platform_fee_credit_note_reason" AS ENUM (
    'commission_reduction'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "clinic_saas_invoice_status" AS ENUM (
    'pending',
    'issued',
    'failed',
    'dead_lettered',
    'credited'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_fee_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "booking_payment_id" uuid NOT NULL,
  "expert_org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "series" varchar(64),
  "number" varchar(64),
  "toconline_document_id" varchar(255),
  "amount_cents" integer NOT NULL,
  "iva_rate_bps" integer NOT NULL DEFAULT 0,
  "iva_regime" "platform_fee_iva_regime" NOT NULL DEFAULT 'pending',
  "status" "platform_fee_invoice_status" NOT NULL DEFAULT 'pending',
  "legacy_document_ref" varchar(255),
  "pdf_url" text,
  "at_status" "platform_fee_at_status" NOT NULL DEFAULT 'operator_gated',
  "issued_at" timestamp with time zone,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_payment_org_fk";
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_payment_org_fk"
  FOREIGN KEY ("booking_payment_id", "org_id") REFERENCES "booking_payments" ("id", "org_id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_payment_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_fee_invoices"
    ADD CONSTRAINT "platform_fee_invoices_payment_key"
    UNIQUE ("booking_payment_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_fee_invoices"
    ADD CONSTRAINT "platform_fee_invoices_id_org_key"
    UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_invoices_org_idx" ON "platform_fee_invoices" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_invoices_status_idx" ON "platform_fee_invoices" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_invoices_created_idx" ON "platform_fee_invoices" ("created_at");
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_expert_org";
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_expert_org"
  CHECK (org_id = expert_org_id);
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_amount";
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_amount"
  CHECK (amount_cents >= 0);
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_iva_rate";
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_iva_rate"
  CHECK (iva_rate_bps >= 0 AND iva_rate_bps <= 10000);
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" DROP CONSTRAINT IF EXISTS "platform_fee_invoices_attempts";
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ADD CONSTRAINT "platform_fee_invoices_attempts"
  CHECK (attempts >= 0);
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_fee_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS platform_fee_invoices_tenant_isolation ON "platform_fee_invoices";
--> statement-breakpoint
CREATE POLICY platform_fee_invoices_tenant_isolation ON "platform_fee_invoices"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_fee_credit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "platform_fee_invoice_id" uuid NOT NULL,
  "reason" "platform_fee_credit_note_reason" NOT NULL DEFAULT 'commission_reduction',
  "amount_cents" integer NOT NULL,
  "series" varchar(64),
  "number" varchar(64),
  "toconline_document_id" varchar(255),
  "status" "platform_fee_credit_note_status" NOT NULL DEFAULT 'pending',
  "error" text,
  "issued_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" DROP CONSTRAINT IF EXISTS "platform_fee_credit_notes_invoice_org_fk";
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" ADD CONSTRAINT "platform_fee_credit_notes_invoice_org_fk"
  FOREIGN KEY ("platform_fee_invoice_id", "org_id") REFERENCES "platform_fee_invoices" ("id", "org_id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" DROP CONSTRAINT IF EXISTS "platform_fee_credit_notes_id_org_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_fee_credit_notes"
    ADD CONSTRAINT "platform_fee_credit_notes_id_org_key"
    UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_fee_credit_notes_org_idx" ON "platform_fee_credit_notes" ("org_id");
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" DROP CONSTRAINT IF EXISTS "platform_fee_credit_notes_amount";
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" ADD CONSTRAINT "platform_fee_credit_notes_amount"
  CHECK (amount_cents > 0);
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_fee_credit_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS platform_fee_credit_notes_tenant_isolation ON "platform_fee_credit_notes";
--> statement-breakpoint
CREATE POLICY platform_fee_credit_notes_tenant_isolation ON "platform_fee_credit_notes"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_id_org_key"
    UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_saas_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "billing_subscription_id" uuid NOT NULL,
  "stripe_invoice_id" varchar(255) NOT NULL,
  "series" varchar(64),
  "number" varchar(64),
  "toconline_document_id" varchar(255),
  "amount_cents" integer NOT NULL,
  "iva_rate_bps" integer NOT NULL DEFAULT 0,
  "iva_regime" "platform_fee_iva_regime" NOT NULL DEFAULT 'pending',
  "status" "clinic_saas_invoice_status" NOT NULL DEFAULT 'pending',
  "pdf_url" text,
  "at_status" "platform_fee_at_status" NOT NULL DEFAULT 'operator_gated',
  "issued_at" timestamp with time zone,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_subscription_org_fk";
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" ADD CONSTRAINT "clinic_saas_invoices_subscription_org_fk"
  FOREIGN KEY ("billing_subscription_id", "org_id") REFERENCES "billing_subscriptions" ("id", "org_id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_stripe_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clinic_saas_invoices"
    ADD CONSTRAINT "clinic_saas_invoices_stripe_key"
    UNIQUE ("stripe_invoice_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_id_org_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clinic_saas_invoices"
    ADD CONSTRAINT "clinic_saas_invoices_id_org_key"
    UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_saas_invoices_org_idx" ON "clinic_saas_invoices" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_saas_invoices_status_idx" ON "clinic_saas_invoices" ("status");
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_amount";
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" ADD CONSTRAINT "clinic_saas_invoices_amount"
  CHECK (amount_cents >= 0);
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_iva_rate";
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" ADD CONSTRAINT "clinic_saas_invoices_iva_rate"
  CHECK (iva_rate_bps >= 0 AND iva_rate_bps <= 10000);
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" DROP CONSTRAINT IF EXISTS "clinic_saas_invoices_attempts";
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" ADD CONSTRAINT "clinic_saas_invoices_attempts"
  CHECK (attempts >= 0);
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "clinic_saas_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS clinic_saas_invoices_tenant_isolation ON "clinic_saas_invoices";
--> statement-breakpoint
CREATE POLICY clinic_saas_invoices_tenant_isolation ON "clinic_saas_invoices"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
