-- Phase 10.2c: expert CRM contacts and follow-ups (tenant RLS).
DO $$ BEGIN
  CREATE TYPE "crm_lifecycle_stage" AS ENUM ('lead', 'active', 'dormant', 'churned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "crm_follow_up_kind" AS ENUM ('call', 'message', 'review');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "member_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE cascade,
  "name" varchar(200),
  "email_encrypted" text,
  "phone_encrypted" text,
  "lifecycle_stage" "crm_lifecycle_stage" DEFAULT 'lead' NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_by" uuid REFERENCES "auth"."user"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_contacts_org_stage_idx"
  ON "crm_contacts" ("org_id", "lifecycle_stage");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_contacts_org_member_uidx"
  ON "crm_contacts" ("org_id", "member_user_id")
  WHERE member_user_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crm_follow_ups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "contact_id" uuid NOT NULL REFERENCES "crm_contacts"("id") ON DELETE cascade,
  "due_at" timestamptz NOT NULL,
  "kind" "crm_follow_up_kind" NOT NULL,
  "note_encrypted" text,
  "done_at" timestamptz,
  "notified_at" timestamptz,
  "created_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_follow_ups_org_open_due_idx"
  ON "crm_follow_ups" ("org_id", "due_at")
  WHERE done_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_follow_ups_contact_idx"
  ON "crm_follow_ups" ("contact_id");
--> statement-breakpoint
ALTER TABLE "crm_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "crm_contacts_tenant_isolation" ON "crm_contacts";
--> statement-breakpoint
CREATE POLICY "crm_contacts_tenant_isolation" ON "crm_contacts"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint
ALTER TABLE "crm_follow_ups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crm_follow_ups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "crm_follow_ups_tenant_isolation" ON "crm_follow_ups";
--> statement-breakpoint
CREATE POLICY "crm_follow_ups_tenant_isolation" ON "crm_follow_ups"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
