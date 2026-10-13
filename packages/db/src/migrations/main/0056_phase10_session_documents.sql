-- Phase 10.1 session documents: private Blob objects on the member
-- history for a booking. D-07 stays deferred; recording off; not HIPAA.
-- Pathname prefix records/<expertOrgId>/<memberUserId>/<actorUserId>/.

DO $$ BEGIN
  CREATE TYPE "session_document_scope" AS ENUM ('expert_only', 'shared');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "member_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE set null,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE cascade,
  "blob_pathname" text NOT NULL,
  "blob_url" text NOT NULL,
  "mime" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "metadata_encrypted" text NOT NULL,
  "scope" "session_document_scope" NOT NULL,
  "uploaded_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_documents_blob_pathname_uidx"
  ON "session_documents" ("blob_pathname");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_documents_org_idx"
  ON "session_documents" ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_documents_member_idx"
  ON "session_documents" ("member_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_documents_booking_idx"
  ON "session_documents" ("booking_id");
--> statement-breakpoint
ALTER TABLE "session_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_author_select" ON "session_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_author_insert" ON "session_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_author_update" ON "session_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_author_delete" ON "session_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_clinic_shared_read" ON "session_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS "session_documents_member_shared_read" ON "session_documents";
--> statement-breakpoint
CREATE POLICY "session_documents_author_select" ON "session_documents"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND (
      uploaded_by::text = current_setting('eleva.user_id', true)
      OR EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.id = session_documents.booking_id
          AND b.expert_user_id::text = current_setting('eleva.user_id', true)
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "session_documents_author_insert" ON "session_documents"
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    AND uploaded_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "session_documents_author_update" ON "session_documents"
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND uploaded_by::text = current_setting('eleva.user_id', true)
  )
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    AND uploaded_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "session_documents_author_delete" ON "session_documents"
  AS PERMISSIVE FOR DELETE TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND uploaded_by::text = current_setting('eleva.user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "session_documents_clinic_shared_read" ON "session_documents"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    deleted_at IS NULL
    AND scope = 'shared'
    AND org_id::text = current_setting('eleva.org_id', true)
    AND member_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.organization o
      WHERE o.id = session_documents.org_id AND o.clinic_shared_records = true
    )
    AND EXISTS (
      SELECT 1 FROM expert_profiles ep
      WHERE ep.org_id = session_documents.org_id
        AND ep.user_id::text = current_setting('eleva.user_id', true)
    )
    AND NOT EXISTS (
      SELECT 1 FROM record_access_optouts opt
      WHERE opt.member_user_id = session_documents.member_user_id
        AND opt.org_id = session_documents.org_id
    )
  );
--> statement-breakpoint
CREATE POLICY "session_documents_member_shared_read" ON "session_documents"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    deleted_at IS NULL
    AND scope = 'shared'
    AND member_user_id::text = current_setting('eleva.user_id', true)
  );
