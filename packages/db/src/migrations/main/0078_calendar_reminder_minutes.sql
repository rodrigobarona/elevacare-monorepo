-- The reminder on sessions Eleva adds to an expert's own calendar.
-- NULL keeps the calendar app's usual reminder (Eleva sends no override).
-- Stored with the default destination so one setting covers every session.
ALTER TABLE "calendar_destinations" ADD COLUMN IF NOT EXISTS "reminder_minutes" integer;--> statement-breakpoint
ALTER TABLE "calendar_destinations" DROP CONSTRAINT IF EXISTS "calendar_destinations_reminder_minutes_range";--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_reminder_minutes_range" CHECK ("calendar_destinations"."reminder_minutes" IS NULL OR "calendar_destinations"."reminder_minutes" BETWEEN 0 AND 1440);
