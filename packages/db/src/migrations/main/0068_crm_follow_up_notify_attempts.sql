-- Due-digest retry cap. Failed sends increment notify_attempts; the
-- hourly sweep ignores rows at 5 so they cannot occupy the 500-row scan.
ALTER TABLE "crm_follow_ups"
  ADD COLUMN IF NOT EXISTS "notify_attempts" integer NOT NULL DEFAULT 0;
