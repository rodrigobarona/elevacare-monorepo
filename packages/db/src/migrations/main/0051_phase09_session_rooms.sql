-- Phase 09 session lifecycle: Daily room columns, delegated participants,
-- webhook idempotency, and expert note drafts. Idempotent enough to re-run
-- ALTER TYPE ADD VALUE.

ALTER TYPE "session_status" ADD VALUE IF NOT EXISTS 'live';
--> statement-breakpoint
ALTER TYPE "session_status" ADD VALUE IF NOT EXISTS 'ended';
--> statement-breakpoint
ALTER TYPE "session_status" ADD VALUE IF NOT EXISTS 'room_unresolved';
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "session_attendance" AS ENUM ('both', 'expert_only', 'member_only', 'nobody');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "session_participant_role" AS ENUM ('delegate', 'supervisor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

UPDATE "sessions" SET "status" = 'live' WHERE "status" = 'in_progress';
--> statement-breakpoint
UPDATE "sessions" SET "status" = 'ended' WHERE "status" = 'completed';
--> statement-breakpoint

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "attendance" "session_attendance",
  ADD COLUMN IF NOT EXISTS "participants" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "room_created_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "room_create_attempt_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "room_create_lease_until" timestamptz,
  ADD COLUMN IF NOT EXISTS "room_attempt_seq" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "room_fingerprint_exp" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_event_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "started_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "ended_at" timestamptz;
--> statement-breakpoint

DELETE FROM "sessions"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "booking_id"
        ORDER BY ("daily_room_name" IS NULL), "created_at" DESC
      ) AS rn
    FROM "sessions"
  ) ranked
  WHERE ranked.rn > 1
);
--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_booking_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_booking_uidx" ON "sessions" ("booking_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_daily_room_name_uidx"
  ON "sessions" ("daily_room_name")
  WHERE "daily_room_name" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_room_fingerprint_exp_uidx"
  ON "sessions" ("room_fingerprint_exp")
  WHERE "room_fingerprint_exp" IS NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "role" "session_participant_role" NOT NULL,
  "added_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "added_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz,
  "ejected_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_participants_booking_user_uidx"
  ON "session_participants" ("booking_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_participants_org_idx" ON "session_participants" ("org_id");
--> statement-breakpoint
ALTER TABLE "session_participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_participants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "session_participants_tenant_isolation" ON "session_participants";
--> statement-breakpoint
CREATE POLICY "session_participants_tenant_isolation" ON "session_participants"
  AS PERMISSIVE FOR ALL TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    OR user_id::text = current_setting('eleva.user_id', true)
  )
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_note_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE cascade,
  "body" jsonb NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_note_drafts_booking_uidx"
  ON "session_note_drafts" ("booking_id");
--> statement-breakpoint
ALTER TABLE "session_note_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session_note_drafts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "session_note_drafts_tenant_isolation" ON "session_note_drafts";
--> statement-breakpoint
CREATE POLICY "session_note_drafts_tenant_isolation" ON "session_note_drafts"
  AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "daily_webhook_events" (
  "event_id" varchar(255) PRIMARY KEY NOT NULL,
  "type" varchar(128) NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL,
  "processed_at" timestamptz,
  "payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_webhook_events_type_idx" ON "daily_webhook_events" ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_webhook_events_received_idx" ON "daily_webhook_events" ("received_at");
--> statement-breakpoint
ALTER TABLE "daily_webhook_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "daily_webhook_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "daily_webhook_events_staff_only" ON "daily_webhook_events";
--> statement-breakpoint
CREATE POLICY "daily_webhook_events_staff_only" ON "daily_webhook_events"
  AS PERMISSIVE FOR ALL TO public
  USING (current_setting('eleva.platform_admin', true) = 'true')
  WITH CHECK (current_setting('eleva.platform_admin', true) = 'true');
