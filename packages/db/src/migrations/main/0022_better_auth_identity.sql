CREATE SCHEMA IF NOT EXISTS "auth";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_user_email_uidx" ON "auth"."user" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_session_token_uidx" ON "auth"."session" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_session_user_idx" ON "auth"."session" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_account_user_idx" ON "auth"."account" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."organization" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text,
	"type" text DEFAULT 'personal' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_organization_slug_uidx" ON "auth"."organization" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_member_user_org_uidx" ON "auth"."member" USING btree ("user_id", "organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_member_org_idx" ON "auth"."member" USING btree ("organization_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inviter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_invitation_org_idx" ON "auth"."invitation" USING btree ("organization_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."twoFactor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."passkey" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone,
	"aaguid" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_passkey_user_idx" ON "auth"."passkey" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."jwks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."apikey" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" text,
	"reference_id" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_apikey_user_idx" ON "auth"."apikey" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_apikey_reference_idx" ON "auth"."apikey" USING btree ("reference_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."session" ADD CONSTRAINT "auth_session_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."account" ADD CONSTRAINT "auth_account_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."member" ADD CONSTRAINT "auth_member_org_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."member" ADD CONSTRAINT "auth_member_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."invitation" ADD CONSTRAINT "auth_invitation_org_id_fk" FOREIGN KEY ("organization_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."invitation" ADD CONSTRAINT "auth_invitation_inviter_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."twoFactor" ADD CONSTRAINT "auth_two_factor_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."passkey" ADD CONSTRAINT "auth_passkey_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."apikey" ADD CONSTRAINT "auth_apikey_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_data_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key_version" integer NOT NULL,
	"kek_version" text NOT NULL,
	"wrapped_dek" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "org_data_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
 CREATE POLICY "org_data_keys_tenant_isolation" ON "org_data_keys" AS PERMISSIVE FOR ALL TO public USING (org_id = current_setting('eleva.org_id', true)::uuid) WITH CHECK (org_id = current_setting('eleva.org_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
INSERT INTO "auth"."user" (
  "id", "name", "email", "email_verified", "image", "created_at", "updated_at"
)
SELECT
  u."id",
  'Legacy Member',
  u."workos_user_id" || '@legacy.eleva.care',
  true,
  u."avatar_url",
  u."created_at",
  u."updated_at"
FROM "users" u
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "auth"."organization" (
  "id", "name", "slug", "created_at", "type"
)
SELECT
  o."id",
  COALESCE(o."slug", 'organization'),
  COALESCE(
    NULLIF(o."slug", ''),
    'org-' || replace(o."id"::text, '-', '')
  ),
  o."created_at",
  o."type"::text
FROM "organizations" o
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "auth"."member" (
  "id", "organization_id", "user_id", "role", "created_at"
)
SELECT
  m."id",
  m."org_id",
  m."user_id",
  CASE WHEN m."workos_role" = 'admin' THEN 'owner' ELSE 'member' END,
  m."created_at"
FROM "memberships" m
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_data_keys" ADD CONSTRAINT "org_data_keys_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bookings" ADD CONSTRAINT "bookings_member_user_id_auth_user_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_user_id_auth_user_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinic_profiles" ADD CONSTRAINT "clinic_profiles_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_practice_locations" ADD CONSTRAINT "expert_practice_locations_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_types" ADD CONSTRAINT "event_types_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_busy_sources" ADD CONSTRAINT "calendar_busy_sources_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_auth_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "auth"."organization"("id") ON DELETE cascade ON UPDATE no action NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "org_data_keys" VALIDATE CONSTRAINT "org_data_keys_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_customers" VALIDATE CONSTRAINT "billing_customers_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" VALIDATE CONSTRAINT "billing_subscriptions_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_member_user_id_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_member_user_id_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "slot_reservations" VALIDATE CONSTRAINT "slot_reservations_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "clinic_profiles" VALIDATE CONSTRAINT "clinic_profiles_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "event_locations" VALIDATE CONSTRAINT "event_locations_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" VALIDATE CONSTRAINT "expert_practice_locations_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "event_types" VALIDATE CONSTRAINT "event_types_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" VALIDATE CONSTRAINT "calendar_busy_sources_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_destinations" VALIDATE CONSTRAINT "calendar_destinations_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "expert_integrations" VALIDATE CONSTRAINT "expert_integrations_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "expert_profiles" VALIDATE CONSTRAINT "expert_profiles_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "expert_profiles" VALIDATE CONSTRAINT "expert_profiles_user_id_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "memberships" VALIDATE CONSTRAINT "memberships_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "memberships" VALIDATE CONSTRAINT "memberships_user_id_auth_user_id_fk";
--> statement-breakpoint
ALTER TABLE "availability_rules" VALIDATE CONSTRAINT "availability_rules_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "date_overrides" VALIDATE CONSTRAINT "date_overrides_org_id_auth_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "schedules" VALIDATE CONSTRAINT "schedules_org_id_auth_organization_id_fk";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION auth.forbid_legacy_identity_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('eleva.legacy_identity_writes', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'legacy identity table % is read-only; write auth.* instead', TG_TABLE_NAME
    USING ERRCODE = 'read_only_sql_transaction';
END;
$$;

