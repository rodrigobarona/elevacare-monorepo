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
