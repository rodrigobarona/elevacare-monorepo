-- Per-event-type and per-mode destination calendar overrides.
-- Resolution: mode override > event type override > calendar_destinations default > ICS e-mail.

ALTER TABLE "event_types"
  ADD COLUMN IF NOT EXISTS "destination_integration_id" uuid,
  ADD COLUMN IF NOT EXISTS "destination_external_calendar_id" text;

ALTER TABLE "event_type_modes"
  ADD COLUMN IF NOT EXISTS "destination_integration_id" uuid,
  ADD COLUMN IF NOT EXISTS "destination_external_calendar_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_types_destination_pair'
  ) THEN
    ALTER TABLE "event_types"
      ADD CONSTRAINT "event_types_destination_pair"
      CHECK (
        ("destination_integration_id" IS NULL) =
        ("destination_external_calendar_id" IS NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_type_modes_destination_pair'
  ) THEN
    ALTER TABLE "event_type_modes"
      ADD CONSTRAINT "event_type_modes_destination_pair"
      CHECK (
        ("destination_integration_id" IS NULL) =
        ("destination_external_calendar_id" IS NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_types_destination_integration_fk'
  ) THEN
    ALTER TABLE "event_types"
      ADD CONSTRAINT "event_types_destination_integration_fk"
      FOREIGN KEY ("destination_integration_id")
      REFERENCES "expert_integrations" ("id")
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_type_modes_destination_integration_fk'
  ) THEN
    ALTER TABLE "event_type_modes"
      ADD CONSTRAINT "event_type_modes_destination_integration_fk"
      FOREIGN KEY ("destination_integration_id")
      REFERENCES "expert_integrations" ("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- FK SET NULL only clears destination_integration_id; keep the pair CHECK
-- satisfied by nulling the calendar id in the same UPDATE.
CREATE OR REPLACE FUNCTION clear_destination_pair() RETURNS trigger AS $$
BEGIN
  IF NEW.destination_integration_id IS NULL THEN
    NEW.destination_external_calendar_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS event_types_clear_destination_pair ON event_types;
CREATE TRIGGER event_types_clear_destination_pair
  BEFORE UPDATE OF destination_integration_id ON event_types
  FOR EACH ROW EXECUTE FUNCTION clear_destination_pair();

DROP TRIGGER IF EXISTS event_type_modes_clear_destination_pair ON event_type_modes;
CREATE TRIGGER event_type_modes_clear_destination_pair
  BEFORE UPDATE OF destination_integration_id ON event_type_modes
  FOR EACH ROW EXECUTE FUNCTION clear_destination_pair();

-- Snapshot destination used at create so reschedule/cancel stay on that calendar.
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "calendar_destination_integration_id" uuid,
  ADD COLUMN IF NOT EXISTS "calendar_destination_external_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_calendar_destination_pair'
  ) THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_calendar_destination_pair"
      CHECK (
        ("calendar_destination_integration_id" IS NULL) =
        ("calendar_destination_external_id" IS NULL)
      );
  END IF;
END $$;
