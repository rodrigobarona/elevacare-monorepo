-- Booking payments: Checkout Session (ui_mode elements) trail.
-- Stores the session, Customer, Stripe discount, presentment amount,
-- and billing address so Adaptive Pricing and VAT stay on the Stripe objects.
ALTER TABLE "slot_reservations"
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "buyer_business_name" varchar(200);
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "billing_address" jsonb;
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "stripe_promotion_code_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "discount_cents" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "presentment_currency" varchar(3);
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD COLUMN IF NOT EXISTS "presentment_amount_cents" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "slot_reservations_stripe_cs_idx"
  ON "slot_reservations" ("stripe_checkout_session_id")
  WHERE "stripe_checkout_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_stripe_cs_idx"
  ON "bookings" ("stripe_checkout_session_id")
  WHERE "stripe_checkout_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "booking_payments_stripe_cs_idx"
  ON "booking_payments" ("stripe_checkout_session_id")
  WHERE "stripe_checkout_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_payments_stripe_customer_idx"
  ON "booking_payments" ("stripe_customer_id")
  WHERE "stripe_customer_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD CONSTRAINT "booking_payments_discount"
  CHECK ("discount_cents" >= 0);
--> statement-breakpoint
ALTER TABLE "booking_payments"
  ADD CONSTRAINT "booking_payments_presentment_amount"
  CHECK (
    "presentment_amount_cents" IS NULL
    OR "presentment_amount_cents" >= 0
  );
