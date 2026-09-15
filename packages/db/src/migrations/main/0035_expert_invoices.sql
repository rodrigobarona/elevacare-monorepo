-- Phase 07.2.1: expert_invoices + optional booking buyer tax id.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

DO $$ BEGIN
  CREATE TYPE "expert_invoice_status" AS ENUM (
    'pending',
    'issued',
    'failed',
    'manual_pending',
    'manual_issued'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "buyer_tax_id" varchar(32);
--> statement-breakpoint
-- Drop the composite FK first. A retry after bookings_id_org_key was
-- recreated would otherwise fail: expert_invoices_booking_org_fk depends
-- on that unique constraint.
DO $$ BEGIN
  IF to_regclass('expert_invoices') IS NOT NULL THEN
    ALTER TABLE "expert_invoices"
      DROP CONSTRAINT IF EXISTS "expert_invoices_booking_org_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_id_org_key";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_id_org_key" UNIQUE ("id", "org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expert_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "booking_id" uuid NOT NULL,
  "expert_org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE RESTRICT,
  "adapter" "invoicing_provider" NOT NULL,
  "external_id" varchar(255),
  "number" varchar(64),
  "amount_cents" integer NOT NULL,
  "member_nif" varchar(32),
  "status" "expert_invoice_status" NOT NULL DEFAULT 'pending',
  "pdf_url" text,
  "issued_at" timestamp with time zone,
  "error" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_booking_org_fk";
--> statement-breakpoint
ALTER TABLE "expert_invoices" ADD CONSTRAINT "expert_invoices_booking_org_fk"
  FOREIGN KEY ("booking_id", "org_id") REFERENCES "bookings" ("id", "org_id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_booking_expert_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "expert_invoices_booking_expert_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "expert_invoices"
    ADD CONSTRAINT "expert_invoices_booking_expert_key"
    UNIQUE ("booking_id", "expert_org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_id_org_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "expert_invoices_id_org_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "expert_invoices"
    ADD CONSTRAINT "expert_invoices_id_org_key"
    UNIQUE ("id", "org_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_invoices_org_idx" ON "expert_invoices" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_invoices_status_idx" ON "expert_invoices" ("status");
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_expert_org";
--> statement-breakpoint
ALTER TABLE "expert_invoices" ADD CONSTRAINT "expert_invoices_expert_org"
  CHECK (org_id = expert_org_id);
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_amount";
--> statement-breakpoint
ALTER TABLE "expert_invoices" ADD CONSTRAINT "expert_invoices_amount"
  CHECK (amount_cents >= 0);
--> statement-breakpoint
ALTER TABLE "expert_invoices" DROP CONSTRAINT IF EXISTS "expert_invoices_attempts";
--> statement-breakpoint
ALTER TABLE "expert_invoices" ADD CONSTRAINT "expert_invoices_attempts"
  CHECK (attempts >= 0);
--> statement-breakpoint
ALTER TABLE "expert_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expert_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS expert_invoices_tenant_isolation ON "expert_invoices";
--> statement-breakpoint
CREATE POLICY expert_invoices_tenant_isolation ON "expert_invoices"
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
