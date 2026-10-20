-- AUD-046: optional Instant Book lead time. Slots starting sooner than this
-- need the expert to confirm. NULL keeps every slot instant.
ALTER TABLE "event_types" ADD COLUMN IF NOT EXISTS "instant_book_lead_minutes" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_types" ADD CONSTRAINT "event_types_instant_book_lead_minutes_check"
    CHECK ("instant_book_lead_minutes" IS NULL OR ("instant_book_lead_minutes" > 0 AND "instant_book_lead_minutes" <= 10080));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
