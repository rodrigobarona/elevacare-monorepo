-- Migration: 0019_calendar_creation_idempotency
-- Note: This migration adds payout tracking and calendar creation idempotency.
-- The filename reflects the idempotency feature but also includes stripe_payout_id.
--
-- IMPORTANT: For production deployments with large tables, the index should be
-- created CONCURRENTLY to avoid locking the table. Since Drizzle runs migrations
-- within transactions (which don't support CONCURRENTLY), you may need to:
-- 1. Run the ALTER TABLE statements via Drizzle
-- 2. Manually run the index creation outside the transaction:
--    CREATE INDEX CONCURRENTLY IF NOT EXISTS "meetings_payout_id_idx"
--      ON "meetings" USING btree ("stripe_payout_id");

ALTER TABLE "meetings" ADD COLUMN "stripe_payout_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "calendar_creation_claimed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Note: For large tables, consider running this CONCURRENTLY outside the migration transaction
CREATE INDEX IF NOT EXISTS "meetings_payout_id_idx" ON "meetings" USING btree ("stripe_payout_id");