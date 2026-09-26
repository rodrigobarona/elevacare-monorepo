ALTER TABLE "slot_reservations"
  ADD COLUMN IF NOT EXISTS "cancellation_policy" "cancellation_policy";
