-- Phase 04.1b booking finalize (additive). RLS: slot_reservations =
-- tenant-owned; bookings = dual-organization (org_id OR counterparty_org_id);
-- booking_payments and consents = tenant-owned (expert org).
-- slot_reservations.status 'active' is the reserved hold; remap to
-- 'reserved' in a later migration after this ADD VALUE commits.
-- Do not invent CONSENT_DOCUMENTS version ids here (04.2 D-gate).

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'reserved';
--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'pending_payment';
--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'refunded';
--> statement-breakpoint
ALTER TYPE "public"."slot_reservation_status" ADD VALUE IF NOT EXISTS 'reserved';
--> statement-breakpoint
ALTER TYPE "public"."slot_reservation_status" ADD VALUE IF NOT EXISTS 'released_while_processing';
--> statement-breakpoint
CREATE TYPE "public"."booking_payment_status" AS ENUM(
  'intent_pending',
  'requires_payment',
  'succeeded',
  'failed',
  'refunded'
);
--> statement-breakpoint
CREATE TYPE "public"."consent_subject_kind" AS ENUM('user', 'guest');
--> statement-breakpoint
CREATE TYPE "public"."consent_source" AS ENUM('funnel', 'account', 'import');
--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM(
  'terms',
  'privacy',
  'health_data_processing'
);
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "capability_hash" char(64);
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "user_id" uuid REFERENCES "auth"."user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "expert_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "stripe_payment_intent_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "event_type_mode_id" uuid;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "price_cents" integer;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "currency" varchar(3);
--> statement-breakpoint
UPDATE "slot_reservations" sr
SET "expert_user_id" = ep.user_id
FROM "expert_profiles" ep
WHERE ep.id = sr.expert_profile_id
  AND sr.expert_user_id IS NULL;
--> statement-breakpoint
UPDATE "slot_reservations"
SET "capability_hash" = encode(sha256(id::text::bytea), 'hex')
WHERE "capability_hash" IS NULL;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ALTER COLUMN "capability_hash" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ALTER COLUMN "expert_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_price_cents"
  CHECK (price_cents IS NULL OR price_cents >= 0);
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_currency_eur"
  CHECK (currency IS NULL OR currency = 'EUR');
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_price_currency"
  CHECK ((price_cents IS NULL) = (currency IS NULL));
--> statement-breakpoint
CREATE UNIQUE INDEX "slot_reservations_stripe_pi_idx"
  ON "slot_reservations" ("stripe_payment_intent_id")
  WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_mode_fk"
  FOREIGN KEY ("org_id", "event_type_mode_id")
  REFERENCES "event_type_modes"("org_id", "id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_no_overlap"
  EXCLUDE USING gist (
    expert_user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('active', 'converted'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reservation_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "counterparty_org_id" uuid REFERENCES "auth"."organization"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "expert_user_id" uuid REFERENCES "auth"."user"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_email" varchar(320);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_name" varchar(200);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_phone" varchar(32);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_type_mode_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "language" varchar(16);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "member_country" varchar(2);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_link_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "price_cents" integer;
--> statement-breakpoint
UPDATE "bookings" b
SET "expert_user_id" = ep.user_id
FROM "expert_profiles" ep
WHERE ep.id = b.expert_profile_id
  AND b.expert_user_id IS NULL;
--> statement-breakpoint
UPDATE "bookings"
SET "price_cents" = "price_amount"
WHERE "price_cents" IS NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "expert_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "member_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reservation_id_key" UNIQUE ("reservation_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reservation_fk"
  FOREIGN KEY ("reservation_id") REFERENCES "slot_reservations"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_mode_fk"
  FOREIGN KEY ("org_id", "event_type_mode_id")
  REFERENCES "event_type_modes"("org_id", "id")
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "booking_links" ADD CONSTRAINT "booking_links_org_id_id_key" UNIQUE ("org_id", "id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_link_fk"
  FOREIGN KEY ("org_id", "booking_link_id")
  REFERENCES "booking_links"("org_id", "id")
  ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_price_cents"
  CHECK (price_cents IS NULL OR price_cents >= 0);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_currency_eur"
  CHECK (currency = 'EUR' OR currency = 'eur');
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_country"
  CHECK (member_country IS NULL OR member_country ~ '^[A-Z]{2}$');
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_or_member"
  CHECK (member_user_id IS NOT NULL OR guest_email IS NOT NULL);
--> statement-breakpoint
DROP POLICY IF EXISTS "bookings_tenant_isolation" ON "bookings";
--> statement-breakpoint
CREATE POLICY "bookings_tenant_isolation" ON "bookings" AS PERMISSIVE FOR ALL TO public
  USING (
    org_id::text = current_setting('eleva.org_id', true)
    OR counterparty_org_id::text = current_setting('eleva.org_id', true)
  )
  WITH CHECK (
    org_id::text = current_setting('eleva.org_id', true)
    OR counterparty_org_id::text = current_setting('eleva.org_id', true)
  );
--> statement-breakpoint
CREATE TABLE "booking_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "stripe_payment_intent_id" varchar(255),
  "stripe_charge_id" varchar(255),
  "status" "booking_payment_status" NOT NULL DEFAULT 'intent_pending',
  "amount_cents" integer NOT NULL,
  "application_fee_cents" integer NOT NULL DEFAULT 0,
  "transfer_group" varchar(255),
  "stripe_idempotency_key" varchar(255) NOT NULL,
  "payment_method_type" varchar(64),
  "paid_at" timestamp with time zone,
  "refunded_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "booking_payments_booking_id_key" UNIQUE ("booking_id"),
  CONSTRAINT "booking_payments_amount" CHECK (amount_cents >= 0),
  CONSTRAINT "booking_payments_fee" CHECK (application_fee_cents >= 0),
  CONSTRAINT "booking_payments_refunded" CHECK (refunded_cents >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_stripe_pi_idx"
  ON "booking_payments" ("stripe_payment_intent_id")
  WHERE "stripe_payment_intent_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_idempotency_idx"
  ON "booking_payments" ("stripe_idempotency_key");
--> statement-breakpoint
CREATE INDEX "booking_payments_org_idx" ON "booking_payments" ("org_id");
--> statement-breakpoint
ALTER TABLE "booking_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "booking_payments_tenant_isolation" ON "booking_payments" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
--> statement-breakpoint
CREATE TABLE "consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "subject_kind" "consent_subject_kind" NOT NULL,
  "user_id" uuid REFERENCES "auth"."user"("id") ON DELETE SET NULL,
  "guest_email_hash" char(64),
  "kind" "consent_kind" NOT NULL,
  "document_version" text NOT NULL,
  "locale" varchar(8) NOT NULL,
  "source" "consent_source" NOT NULL,
  "reservation_id" uuid REFERENCES "slot_reservations"("id") ON DELETE SET NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "withdrawn_at" timestamp with time zone,
  CONSTRAINT "consents_subject"
    CHECK (
      (subject_kind = 'user' AND user_id IS NOT NULL)
      OR (subject_kind = 'guest' AND guest_email_hash IS NOT NULL)
    )
);
--> statement-breakpoint
CREATE INDEX "consents_org_idx" ON "consents" ("org_id");
--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" ("user_id");
--> statement-breakpoint
CREATE INDEX "consents_reservation_idx" ON "consents" ("reservation_id");
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "consents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "consents_tenant_isolation" ON "consents" AS PERMISSIVE FOR ALL TO public
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
