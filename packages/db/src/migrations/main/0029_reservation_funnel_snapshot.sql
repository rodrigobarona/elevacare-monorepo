-- Phase 04.2c: persist funnel facts on the hold so /payments/intent
-- can insert bookings without a second guest payload.
ALTER TABLE "slot_reservations"
  ADD COLUMN IF NOT EXISTS "funnel" jsonb;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "slot_reservations"
    ADD CONSTRAINT "slot_reservations_funnel_object"
    CHECK ("funnel" IS NULL OR jsonb_typeof("funnel") = 'object') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "slot_reservations"
  VALIDATE CONSTRAINT "slot_reservations_funnel_object";
