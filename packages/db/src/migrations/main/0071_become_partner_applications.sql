-- Launch legal posture (decision log 2026-10-29): only experts whose licence
-- Eleva staff verified may be listed. Recreates become_partner_applications
-- (dropped in 0013) and stores the declared licence on the expert profile.
-- Profiles already `active` stay active (no backfill, no auto-suspend); the
-- staff queue lists them as "Needs verification" until a licence is approved.
ALTER TABLE "expert_profiles" ADD COLUMN IF NOT EXISTS "professional_body" text;
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN IF NOT EXISTS "licence_number" varchar(64);
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN IF NOT EXISTS "ers_registration_number" varchar(32);
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "partner_application_status" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "become_partner_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "expert_profile_id" uuid NOT NULL,
  "status" "partner_application_status" DEFAULT 'pending' NOT NULL,
  "professional_body" text NOT NULL,
  "licence_number" varchar(64) NOT NULL,
  "ers_registration_number" varchar(32) NOT NULL,
  "submitted_at" timestamptz DEFAULT now() NOT NULL,
  "reviewer_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE restrict,
  "reviewed_at" timestamptz,
  "reason" text,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "become_partner_applications_profile_fk"
    FOREIGN KEY ("org_id", "expert_profile_id")
    REFERENCES "expert_profiles"("org_id", "id") ON DELETE cascade,
  CONSTRAINT "become_partner_applications_reason"
    CHECK (status NOT IN ('rejected', 'needs_changes') OR (reason IS NOT NULL AND length(btrim(reason)) > 0)),
  CONSTRAINT "become_partner_applications_approved_verification"
    CHECK (status <> 'approved' OR (reviewer_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND checklist->>'register_checked' = 'true')),
  CONSTRAINT "become_partner_applications_checklist_shape"
    CHECK (jsonb_typeof(checklist) = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "become_partner_applications_open_uidx"
  ON "become_partner_applications" ("expert_profile_id")
  WHERE status IN ('pending', 'needs_changes');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "become_partner_applications_profile_idx"
  ON "become_partner_applications" ("expert_profile_id", "submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "become_partner_applications_queue_idx"
  ON "become_partner_applications" ("status", "submitted_at");
--> statement-breakpoint
ALTER TABLE "become_partner_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "become_partner_applications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "become_partner_applications_tenant_isolation" ON "become_partner_applications";
--> statement-breakpoint
CREATE POLICY "become_partner_applications_tenant_isolation" ON "become_partner_applications"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
