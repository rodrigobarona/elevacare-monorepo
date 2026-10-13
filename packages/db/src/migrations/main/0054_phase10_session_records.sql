-- Phase 10.1 session records: encrypted intake / notes / live transcript
-- on the member history for a booking. D-07 stays deferred; recording off.
-- clinic_shared_records defaults off (D-11 author-only until Phase 11).

ALTER TABLE "auth"."organization"
  ADD COLUMN IF NOT EXISTS "clinic_shared_records" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "record_kind" AS ENUM (
    'intake',
    'note',
    'transcript',
    'ai_draft',
    'internal_report',
    'report',
    'document_ref'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "record_access_optouts" (
  "member_user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE cascade,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("member_user_id", "org_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "record_access_optouts_org_idx"
  ON "record_access_optouts" ("org_id");
--> statement-breakpoint
ALTER TABLE "record_access_optouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_access_optouts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "record_access_optouts_member" ON "record_access_optouts";
--> statement-breakpoint
DROP POLICY IF EXISTS "record_access_optouts_org_read" ON "record_access_optouts";
--> statement-breakpoint
CREATE POLICY "record_access_optouts_member" ON "record_access_optouts"
  AS PERMISSIVE FOR ALL TO public
  USING (member_user_id::text = current_setting('eleva.user_id', true))
  WITH CHECK (member_user_id::text = current_setting('eleva.user_id', true));
--> statement-breakpoint
CREATE POLICY "record_access_optouts_org_read" ON "record_access_optouts"
  AS PERMISSIVE FOR SELECT TO public
  USING (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "member_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE set null,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE cascade,
  "kind" "record_kind" NOT NULL,
  "title_encrypted" text NOT NULL,
  "body_encrypted" text NOT NULL,
  "published_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  "created_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_org_idx" ON "records" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_member_idx" ON "records" ("member_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_booking_idx" ON "records" ("booking_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "records_booking_kind_uidx"
  ON "records" ("booking_id", "kind")
  WHERE "booking_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "records_author_write" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_author_select" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_author_insert" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_author_update" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_author_delete" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_clinic_shared_read" ON "records";
--> statement-breakpoint
DROP POLICY IF EXISTS "records_member_published_read" ON "records";
--> statement-breakpoint
CREATE POLICY "records_author_select" ON "records"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND (
      created_by::text = current_setting('eleva.user_id', true)
      OR EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = records.booking_id
          AND b.expert_user_id::text = current_setting('eleva.user_id', true)
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "records_author_insert" ON "records"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    AND created_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "records_author_update" ON "records"
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND created_by::text = current_setting('eleva.user_id', true)
  )
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    AND created_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "records_author_delete" ON "records"
  AS PERMISSIVE FOR DELETE TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND created_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "records_clinic_shared_read" ON "records"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND kind <> 'internal_report'
    AND member_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.organization o
      WHERE o.id = records.org_id AND o.clinic_shared_records = true
    )
    AND EXISTS (
      SELECT 1 FROM expert_profiles ep
      WHERE ep.org_id = records.org_id
        AND ep.user_id::text = current_setting('eleva.user_id', true)
    )
    AND NOT EXISTS (
      SELECT 1 FROM record_access_optouts opt
      WHERE opt.member_user_id = records.member_user_id
        AND opt.org_id = records.org_id
    )
  );
--> statement-breakpoint
CREATE POLICY "records_member_published_read" ON "records"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    published_at IS NOT NULL
    AND member_user_id::text = current_setting('eleva.user_id', true)
  );
