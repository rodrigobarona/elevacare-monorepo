-- Phase 05.1: member privacy schema (D-12 working pre-launch).
-- RLS: notification_preferences, dsar_requests, and
-- account_deletion_requests are owner-user-visible (user_id = eleva.user_id).
-- Do not change bookings / consents RLS classes.

ALTER TABLE "auth"."user" ADD COLUMN "timezone" text;
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "locale" text;
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "deletion_scheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TYPE "public"."consent_kind" ADD VALUE IF NOT EXISTS 'marketing';
--> statement-breakpoint
ALTER TYPE "public"."booking_payment_status" ADD VALUE IF NOT EXISTS 'refund_pending';
--> statement-breakpoint
ALTER TABLE "booking_payments" ADD COLUMN "receipt_url" text;
--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "subject_pseudonym" bytea;
--> statement-breakpoint
ALTER TABLE "consents" DROP CONSTRAINT "consents_subject";
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_subject"
  CHECK (
    (subject_kind = 'user' AND user_id IS NOT NULL)
    OR (subject_kind = 'guest' AND guest_email_hash IS NOT NULL)
    OR (
      booking_id IS NOT NULL
      AND user_id IS NULL
      AND guest_email_hash IS NULL
      AND subject_pseudonym IS NOT NULL
    )
  );
--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'sms', 'in_app');
--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM(
  'booking',
  'reminder',
  'payment',
  'marketing',
  'system'
);
--> statement-breakpoint
CREATE TYPE "public"."dsar_request_status" AS ENUM(
  'pending',
  'processing',
  'ready',
  'expired',
  'failed'
);
--> statement-breakpoint
CREATE TYPE "public"."account_deletion_request_status" AS ENUM(
  'pending',
  'cancelled',
  'completed'
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "channel" "notification_channel" NOT NULL,
  "category" "notification_category" NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "quiet_hours_start" time,
  "quiet_hours_end" time,
  "timezone" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_preferences_user_channel_category_key"
    UNIQUE ("user_id", "channel", "category"),
  CONSTRAINT "notification_preferences_quiet_hours"
    CHECK ((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL))
);
--> statement-breakpoint
CREATE INDEX "notification_preferences_user_idx"
  ON "notification_preferences" ("user_id");
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notification_preferences_owner_user_visible"
  ON "notification_preferences" AS PERMISSIVE FOR ALL TO public
  USING (user_id::text = current_setting('eleva.user_id', true))
  WITH CHECK (user_id::text = current_setting('eleva.user_id', true));
--> statement-breakpoint
CREATE TABLE "dsar_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "status" "dsar_request_status" DEFAULT 'pending' NOT NULL,
  "blob_pathname" text,
  "expires_at" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "dsar_requests_user_idx" ON "dsar_requests" ("user_id");
--> statement-breakpoint
CREATE INDEX "dsar_requests_status_idx" ON "dsar_requests" ("status");
--> statement-breakpoint
ALTER TABLE "dsar_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "dsar_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "dsar_requests_owner_user_visible"
  ON "dsar_requests" AS PERMISSIVE FOR ALL TO public
  USING (user_id::text = current_setting('eleva.user_id', true))
  WITH CHECK (user_id::text = current_setting('eleva.user_id', true));
--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "status" "account_deletion_request_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_deletion_requests_user_idx"
  ON "account_deletion_requests" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_pending_user_idx"
  ON "account_deletion_requests" ("user_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX "account_deletion_requests_scheduled_idx"
  ON "account_deletion_requests" ("scheduled_for")
  WHERE "status" = 'pending';
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_deletion_requests_owner_user_visible"
  ON "account_deletion_requests" AS PERMISSIVE FOR ALL TO public
  USING (user_id::text = current_setting('eleva.user_id', true))
  WITH CHECK (user_id::text = current_setting('eleva.user_id', true));
