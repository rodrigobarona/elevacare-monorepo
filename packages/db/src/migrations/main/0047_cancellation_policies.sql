-- Per-service member cancellation policies (D-06, 2026-09-26).
-- Services pick a preset; bookings snapshot it; payments carry the refund
-- the policy owes. Replaces the never-enforced cancellation_window_hours.
-- Idempotent so a mid-file retry on a Neon preview branch can finish.

DO $$ BEGIN
  CREATE TYPE "cancellation_policy" AS ENUM ('flexible', 'moderate', 'strict');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "cancellation_policy" "cancellation_policy" DEFAULT 'flexible' NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "cancellation_policy" "cancellation_policy" DEFAULT 'flexible' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cancellation_policy_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "refund_due_cents" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_refund_due'
  ) THEN
    ALTER TABLE "booking_payments"
      ADD CONSTRAINT "booking_payments_refund_due"
      CHECK (
        refund_due_cents IS NULL
        OR (refund_due_cents >= 0 AND refund_due_cents <= amount_cents)
      );
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "event_types" DROP CONSTRAINT IF EXISTS "event_types_windows_non_negative";
--> statement-breakpoint
ALTER TABLE "event_types" DROP COLUMN IF EXISTS "cancellation_window_hours";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_types_windows_non_negative'
  ) THEN
    ALTER TABLE "event_types"
      ADD CONSTRAINT "event_types_windows_non_negative"
      CHECK (
        (booking_window_days IS NULL OR booking_window_days >= 0)
        AND minimum_notice_minutes >= 0
        AND buffer_before_minutes >= 0
        AND buffer_after_minutes >= 0
        AND (reschedule_window_hours IS NULL OR reschedule_window_hours >= 0)
        AND position >= 0
      );
  END IF;
END $$;
