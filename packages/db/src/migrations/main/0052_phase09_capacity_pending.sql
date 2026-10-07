-- Phase 09.3: marker for Daily room-capacity repair after a failed
-- updateSessionRoom. The eject-retry job selects only these rows.
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "capacity_pending_at" timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_capacity_pending_idx"
  ON "sessions" ("capacity_pending_at")
  WHERE "capacity_pending_at" IS NOT NULL;
