-- Phase 11.1 clinic foundation. Clinic profile fields for invoices and
-- payouts, the staff-decided clinic verification queue (a clinic's public
-- surface exists only while an approved row exists, like expert licences),
-- and bookings.attributed_org_id for the 0% clinic commission, set only
-- from the booking source.
DO $$ BEGIN
  CREATE TYPE "clinic_payout_mode" AS ENUM ('expert', 'clinic');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD COLUMN IF NOT EXISTS "legal_name" text;
--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD COLUMN IF NOT EXISTS "tax_id" varchar(32);
--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD COLUMN IF NOT EXISTS "billing_address" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD COLUMN IF NOT EXISTS "specialties" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD COLUMN IF NOT EXISTS "payout_mode" "clinic_payout_mode" DEFAULT 'expert' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clinic_profiles" ADD CONSTRAINT "clinic_profiles_billing_address_shape"
    CHECK (jsonb_typeof(billing_address) = 'object');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinic_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "status" "partner_application_status" DEFAULT 'pending' NOT NULL,
  "legal_name" text NOT NULL,
  "tax_id" varchar(32) NOT NULL,
  "submitted_at" timestamptz DEFAULT now() NOT NULL,
  "reviewer_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE restrict,
  "reviewed_at" timestamptz,
  "reason" text,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "clinic_verifications_reason"
    CHECK (status NOT IN ('rejected', 'needs_changes') OR (reason IS NOT NULL AND length(btrim(reason)) > 0)),
  CONSTRAINT "clinic_verifications_approved_verification"
    CHECK (status <> 'approved' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND checklist @> '{"legal_entity_checked": true, "tax_id_checked": true}'::jsonb)),
  CONSTRAINT "clinic_verifications_checklist_shape"
    CHECK (jsonb_typeof(checklist) = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_verifications_open_uidx"
  ON "clinic_verifications" ("org_id")
  WHERE status IN ('pending', 'needs_changes');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_verifications_org_idx"
  ON "clinic_verifications" ("org_id", "submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_verifications_queue_idx"
  ON "clinic_verifications" ("status", "submitted_at");
--> statement-breakpoint
ALTER TABLE "clinic_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "clinic_verifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "clinic_verifications_read" ON "clinic_verifications";
--> statement-breakpoint
CREATE POLICY "clinic_verifications_read" ON "clinic_verifications"
  AS PERMISSIVE FOR SELECT TO public
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
DROP POLICY IF EXISTS "clinic_verifications_expert_file" ON "clinic_verifications";
--> statement-breakpoint
CREATE POLICY "clinic_verifications_expert_file" ON "clinic_verifications"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "clinic_verifications_expert_refile" ON "clinic_verifications";
--> statement-breakpoint
CREATE POLICY "clinic_verifications_expert_refile" ON "clinic_verifications"
  AS PERMISSIVE FOR UPDATE TO public
  USING (org_id::text = current_setting('eleva.org_id', true) AND status IN ('pending', 'needs_changes'))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) AND status = 'pending' AND reviewer_user_id IS NULL AND reviewed_at IS NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "clinic_verifications_staff_write" ON "clinic_verifications";
--> statement-breakpoint
CREATE POLICY "clinic_verifications_staff_write" ON "clinic_verifications"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (current_setting('eleva.platform_admin', true) = 'true');
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "attributed_org_id" uuid REFERENCES "auth"."organization"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_attributed_org_idx"
  ON "bookings" ("attributed_org_id")
  WHERE attributed_org_id IS NOT NULL;
