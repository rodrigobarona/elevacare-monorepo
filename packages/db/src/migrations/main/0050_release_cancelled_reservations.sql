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

-- Fail before moving anything if the moved ranges would overlap each other or
-- another live reservation; those rows need manual reconciliation. The lock
-- keeps concurrent reserveSlot inserts out between the check and the move.
DO $$
DECLARE
  conflicts text;
BEGIN
  LOCK TABLE "slot_reservations" IN SHARE ROW EXCLUSIVE MODE;
  WITH final AS (
    SELECT sr."id", sr."expert_user_id",
      CASE WHEN b."id" IS NULL THEN sr."starts_at" ELSE b."starts_at" END AS "starts_at",
      CASE WHEN b."id" IS NULL THEN sr."ends_at" ELSE b."ends_at" END AS "ends_at",
      b."id" IS NOT NULL AS "moving"
    FROM "slot_reservations" AS sr
    LEFT JOIN "bookings" AS b
      ON b."reservation_id" = sr."id"
      AND sr."status" = 'converted'
      AND b."status" = 'rescheduled'
      AND (sr."starts_at" <> b."starts_at" OR sr."ends_at" <> b."ends_at")
    WHERE sr."status" IN ('active', 'converted')
  )
  SELECT string_agg(a."id"::text || '<>' || o."id"::text, ', ') INTO conflicts
  FROM final AS a
  JOIN final AS o
    ON o."expert_user_id" = a."expert_user_id"
    AND o."id" <> a."id"
    AND (o."moving" = false OR o."id"::text > a."id"::text)
    AND tstzrange(o."starts_at", o."ends_at", '[)')
      && tstzrange(a."starts_at", a."ends_at", '[)')
  WHERE a."moving";
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION '0050: rescheduled reservations conflict after the move (%); reconcile them before migrating', conflicts;
  END IF;

  UPDATE "slot_reservations" AS sr
  SET "starts_at" = b."starts_at", "ends_at" = b."ends_at"
  FROM "bookings" AS b
  WHERE b."reservation_id" = sr."id"
    AND sr."status" = 'converted'
    AND b."status" = 'rescheduled'
    AND (sr."starts_at" <> b."starts_at" OR sr."ends_at" <> b."ends_at");
END $$;
