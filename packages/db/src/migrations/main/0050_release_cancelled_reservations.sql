-- Cancel used to release only `active` reservations, so a paid booking's
-- `converted` reservation kept the slot under slot_reservations_no_overlap
-- after cancellation, and reschedule left it on the old time. Idempotent.

UPDATE "slot_reservations" AS sr
SET "status" = 'released'
FROM "bookings" AS b
WHERE b."reservation_id" = sr."id"
  AND sr."status" = 'converted'
  AND b."status" = 'cancelled';
--> statement-breakpoint

-- Stale holds still count for the exclusion until swept; clear the ones that
-- overlap a rescheduled booking's new time so its reservation can move.
UPDATE "slot_reservations" AS hold
SET "status" = 'expired', "funnel" = hold."funnel" - 'guest'
FROM "slot_reservations" AS sr
JOIN "bookings" AS b ON b."reservation_id" = sr."id"
WHERE sr."status" = 'converted'
  AND b."status" = 'rescheduled'
  AND hold."id" <> sr."id"
  AND hold."expert_user_id" = sr."expert_user_id"
  AND hold."status" = 'active'
  AND hold."expires_at" <= now()
  AND tstzrange(hold."starts_at", hold."ends_at", '[)')
    && tstzrange(b."starts_at", b."ends_at", '[)');
--> statement-breakpoint

UPDATE "slot_reservations" AS sr
SET "starts_at" = b."starts_at", "ends_at" = b."ends_at"
FROM "bookings" AS b
WHERE b."reservation_id" = sr."id"
  AND sr."status" = 'converted'
  AND b."status" = 'rescheduled'
  AND (sr."starts_at" <> b."starts_at" OR sr."ends_at" <> b."ends_at")
  AND NOT EXISTS (
    SELECT 1
    FROM "slot_reservations" AS other
    WHERE other."id" <> sr."id"
      AND other."expert_user_id" = sr."expert_user_id"
      AND other."status" IN ('active', 'converted')
      AND tstzrange(other."starts_at", other."ends_at", '[)')
        && tstzrange(b."starts_at", b."ends_at", '[)')
  );
--> statement-breakpoint

DO $$
DECLARE
  stuck integer;
BEGIN
  SELECT count(*) INTO stuck
  FROM "slot_reservations" AS sr
  JOIN "bookings" AS b ON b."reservation_id" = sr."id"
  WHERE sr."status" = 'converted'
    AND b."status" = 'rescheduled'
    AND (sr."starts_at" <> b."starts_at" OR sr."ends_at" <> b."ends_at");
  IF stuck > 0 THEN
    RAISE NOTICE '0050: % rescheduled reservation(s) overlap another live reservation and were left in place', stuck;
  END IF;
END $$;
