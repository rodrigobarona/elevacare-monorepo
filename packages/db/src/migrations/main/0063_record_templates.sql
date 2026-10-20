-- Phase 10.1f: per-org record templates (not PHI; scrubbed before write).
DO $$ BEGIN
  CREATE TYPE "record_template_kind" AS ENUM ('note', 'report', 'consultation', 'message');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "record_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "kind" "record_template_kind" NOT NULL,
  "locale" varchar(5) NOT NULL,
  "title" varchar(200) NOT NULL,
  "body" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "archived_at" timestamptz,
  "created_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_templates_org_kind_idx"
  ON "record_templates" ("org_id", "kind");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "record_templates_default_uidx"
  ON "record_templates" ("org_id", "kind", "locale")
  WHERE is_default = true AND archived_at IS NULL;
--> statement-breakpoint
ALTER TABLE "record_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "record_templates_tenant_isolation" ON "record_templates";
--> statement-breakpoint
CREATE POLICY "record_templates_tenant_isolation" ON "record_templates"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
