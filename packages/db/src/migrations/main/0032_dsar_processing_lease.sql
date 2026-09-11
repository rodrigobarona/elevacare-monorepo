-- Phase 05.3: DSAR processing lease so a crashed worker can be reclaimed.
ALTER TABLE "dsar_requests" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp with time zone;
