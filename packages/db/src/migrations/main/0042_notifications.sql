-- Phase 08.3: Lane 1 notification inbox, delivery log, suppressions, phone OTP.
-- Does not POST TOConline documents. Issuance success kinds stay off the union.
-- Statements are idempotent so a mid-file retry on a Neon preview branch
-- (statement-by-statement apply, no enclosing transaction) can finish.

CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN IF NOT EXISTS "phone_e164" text;
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN IF NOT EXISTS "phone_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "auth"."user" DROP CONSTRAINT IF EXISTS "auth_user_phone_e164";
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "auth_user_phone_e164"
  CHECK (
    phone_e164 IS NULL
    OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  );
--> statement-breakpoint
ALTER TABLE "auth"."user" DROP CONSTRAINT IF EXISTS "auth_user_phone_verification_state";
--> statement-breakpoint
ALTER TABLE "auth"."user" ADD CONSTRAINT "auth_user_phone_verification_state"
  CHECK ((phone_e164 IS NULL) = (phone_verified_at IS NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth_user_phone_change_requires_verification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_e164 IS DISTINCT FROM OLD.phone_e164
     AND NEW.phone_verified_at IS NOT DISTINCT FROM OLD.phone_verified_at THEN
    RAISE EXCEPTION 'phone_e164 change must update phone_verified_at';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS auth_user_phone_change_requires_verification
  ON "auth"."user";
--> statement-breakpoint
CREATE TRIGGER auth_user_phone_change_requires_verification
  BEFORE UPDATE ON "auth"."user"
  FOR EACH ROW
  EXECUTE FUNCTION auth_user_phone_change_requires_verification();
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."notification_delivery_status" AS ENUM (
    'queued',
    'sent',
    'delivered',
    'bounced',
    'complained',
    'failed',
    'suppressed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."email_suppression_reason" AS ENUM (
    'hard_bounce',
    'complaint'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "org_id" uuid REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "href" text,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_data_object";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_data_object"
  CHECK (jsonb_typeof(data) = 'object');
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind"
  CHECK (
    kind IN (
      'invoice.blocked',
      'invoice.skipped',
      'invoice.pending',
      'booking.confirmed',
      'booking.reminder_24h',
      'booking.reminder_1h',
      'booking.cancelled',
      'booking.rescheduled',
      'payment.failed',
      'payment.receipt',
      'payout.paid',
      'payout.approval_required',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind_org_scope";
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_org_scope"
  CHECK (
    (
      kind IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NULL
    )
    OR (
      kind NOT IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NOT NULL
    )
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx"
  ON "notifications" ("user_id", "created_at")
  WHERE "read_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "notifications" ("org_id");
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_owner_user_visible" ON "notifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_owner_read" ON "notifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_owner_update" ON "notifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_worker_insert" ON "notifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_worker_delete" ON "notifications";
--> statement-breakpoint
CREATE POLICY "notifications_owner_read"
  ON "notifications" AS PERMISSIVE FOR SELECT TO public
  USING (
    user_id::text = current_setting('eleva.user_id', true)
    AND (
      org_id IS NULL
      OR org_id::text = current_setting('eleva.org_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "notifications_owner_update"
  ON "notifications" AS PERMISSIVE FOR UPDATE TO public
  USING (
    user_id::text = current_setting('eleva.user_id', true)
    AND (
      org_id IS NULL
      OR org_id::text = current_setting('eleva.org_id', true)
    )
  )
  WITH CHECK (
    user_id::text = current_setting('eleva.user_id', true)
    AND (
      org_id IS NULL
      OR org_id::text = current_setting('eleva.org_id', true)
    )
  );
--> statement-breakpoint
CREATE POLICY "notifications_worker_insert"
  ON "notifications" AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE POLICY "notifications_worker_delete"
  ON "notifications" AS PERMISSIVE FOR DELETE TO public
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid REFERENCES "auth"."organization"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "kind" text NOT NULL,
  "user_id" uuid REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "recipient_email" citext,
  "channel" "notification_channel" NOT NULL,
  "status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
  "provider_id" text,
  "lease_owner" text NOT NULL,
  "claimed_at" timestamp with time zone NOT NULL,
  "first_attempt_at" timestamp with time zone,
  "sms_body_hash" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_deliveries_recipient"
    CHECK (
      num_nonnulls(user_id, recipient_email) = 1
      AND (recipient_email IS NULL OR channel = 'email')
    )
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_kind";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_kind"
  CHECK (
    kind IN (
      'invoice.blocked',
      'invoice.skipped',
      'invoice.pending',
      'booking.confirmed',
      'booking.reminder_24h',
      'booking.reminder_1h',
      'booking.cancelled',
      'booking.rescheduled',
      'payment.failed',
      'payment.receipt',
      'payout.paid',
      'payout.approval_required',
      'auth.magic_link',
      'auth.verify_email',
      'auth.reset_password',
      'auth.two_factor_otp',
      'auth.org_invitation'
    )
  );
--> statement-breakpoint
ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_kind_org_scope";
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_kind_org_scope"
  CHECK (
    (
      kind IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NULL
    )
    OR (
      kind NOT IN (
        'auth.magic_link',
        'auth.verify_email',
        'auth.reset_password',
        'auth.two_factor_otp'
      )
      AND org_id IS NOT NULL
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_idempotency_recipient_channel_key"
  ON "notification_deliveries" (
    "idempotency_key",
    coalesce("user_id"::text, lower("recipient_email"::text)),
    "channel"
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_claimed_idx"
  ON "notification_deliveries" ("status", "claimed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_user_idx"
  ON "notification_deliveries" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_deliveries_org_idx"
  ON "notification_deliveries" ("org_id");
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_deliveries" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS notification_deliveries_service_only
  ON "notification_deliveries";
--> statement-breakpoint
DROP POLICY IF EXISTS notification_deliveries_tenant_read
  ON "notification_deliveries";
--> statement-breakpoint
CREATE POLICY notification_deliveries_tenant_read
  ON "notification_deliveries" AS PERMISSIVE FOR SELECT TO public
  USING (
    org_id IS NOT NULL
    AND org_id::text = current_setting('eleva.org_id', true)
  );
--> statement-breakpoint
CREATE POLICY notification_deliveries_service_only
  ON "notification_deliveries"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" citext NOT NULL,
  "reason" "email_suppression_reason" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_suppressions" DROP CONSTRAINT IF EXISTS "email_suppressions_email_key";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_suppressions"
    ADD CONSTRAINT "email_suppressions_email_key" UNIQUE ("email");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "email_suppressions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_suppressions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS email_suppressions_service_only ON "email_suppressions";
--> statement-breakpoint
CREATE POLICY email_suppressions_service_only
  ON "email_suppressions"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "auth"."user"("id") ON DELETE CASCADE,
  "phone_e164" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "phone_verifications_phone_e164"
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_verifications_user_idx"
  ON "phone_verifications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_verifications_expires_idx"
  ON "phone_verifications" ("expires_at");
--> statement-breakpoint
ALTER TABLE "phone_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "phone_verifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "phone_verifications_owner_user_visible"
  ON "phone_verifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "phone_verifications_owner_read" ON "phone_verifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "phone_verifications_owner_insert" ON "phone_verifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "phone_verifications_worker_update" ON "phone_verifications";
--> statement-breakpoint
DROP POLICY IF EXISTS "phone_verifications_worker_delete" ON "phone_verifications";
--> statement-breakpoint
DROP POLICY IF EXISTS phone_verifications_service_only ON "phone_verifications";
--> statement-breakpoint
CREATE POLICY phone_verifications_service_only
  ON "phone_verifications"
  USING (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  )
  WITH CHECK (
    current_setting('eleva.platform_admin', true) = 'true'
    OR current_setting('eleva.service', true) = 'domain_events_publisher'
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION notifications_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('eleva.platform_admin', true) = 'true'
     OR current_setting('eleva.service', true) = 'domain_events_publisher' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.href IS DISTINCT FROM OLD.href
     OR NEW.data IS DISTINCT FROM OLD.data
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'notifications owner update may only set read_at';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS notifications_owner_update_guard ON "notifications";
--> statement-breakpoint
CREATE TRIGGER notifications_owner_update_guard
  BEFORE UPDATE ON "notifications"
  FOR EACH ROW
  EXECUTE FUNCTION notifications_owner_update_guard();
