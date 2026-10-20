-- Phase 10 AUD-031 / D-11: expert records are readable by their author only.
-- The booking-expert clause is removed; clinic sharing stays on
-- records_clinic_shared_read and member reads on records_member_published_read.
DROP POLICY IF EXISTS "records_author_select" ON "records";
--> statement-breakpoint
CREATE POLICY "records_author_select" ON "records"
  AS PERMISSIVE FOR SELECT TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    AND created_by::text = current_setting('eleva.user_id', true)
  );
