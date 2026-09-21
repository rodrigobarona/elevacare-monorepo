-- Phase 08.6: persist a booking occurrence id so A→B→A→B reschedules
-- do not share a domain-outbox idempotency key. Incremented in the same
-- transaction as the slot write; rolled back with that write on retry.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "schedule_revision" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_schedule_revision_nonneg";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_schedule_revision_nonneg"
  CHECK (schedule_revision >= 0);
