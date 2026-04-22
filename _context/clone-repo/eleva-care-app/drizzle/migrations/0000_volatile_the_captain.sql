CREATE TYPE "public"."payment_transfer_status_enum" AS ENUM('PENDING', 'APPROVED', 'READY', 'COMPLETED', 'FAILED', 'REFUNDED', 'DISPUTED', 'PAID_OUT');--> statement-breakpoint
CREATE TYPE "public"."day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image" text,
	"parent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"duration_in_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"guest_email" text NOT NULL,
	"guest_name" text NOT NULL,
	"guest_notes" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" text NOT NULL,
	"meeting_url" text,
	"stripe_payment_intent_id" text,
	"stripe_session_id" text,
	"stripe_payment_status" text DEFAULT 'pending',
	"stripe_amount" integer,
	"stripe_application_fee_amount" integer,
	"stripe_transfer_id" text,
	"stripe_transfer_amount" integer,
	"stripe_transfer_status" text DEFAULT 'pending',
	"stripe_transfer_scheduled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "meetings_stripe_session_id_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "meetings_stripe_transfer_id_unique" UNIQUE("stripe_transfer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_org_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_workos_org_id_unique" UNIQUE("workos_org_id"),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_intent_id" text NOT NULL,
	"checkout_session_id" text NOT NULL,
	"event_id" text NOT NULL,
	"expert_connect_account_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"platform_fee" integer NOT NULL,
	"session_start_time" timestamp NOT NULL,
	"scheduled_transfer_time" timestamp NOT NULL,
	"status" "payment_transfer_status_enum" DEFAULT 'PENDING' NOT NULL,
	"transfer_id" text,
	"payout_id" text,
	"stripe_error_code" text,
	"stripe_error_message" text,
	"retry_count" integer DEFAULT 0,
	"requires_approval" boolean DEFAULT false,
	"admin_user_id" text,
	"admin_notes" text,
	"notified_at" timestamp,
	"created" timestamp DEFAULT now() NOT NULL,
	"updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"profile_picture" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"headline" text,
	"short_bio" text,
	"long_bio" text,
	"primary_category_id" uuid,
	"secondary_category_id" uuid,
	"social_links" json,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_top_expert" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"practitioner_agreement_accepted_at" timestamp,
	"practitioner_agreement_version" text,
	"practitioner_agreement_ip_address" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"expert_id" text NOT NULL,
	"guest_email" text NOT NULL,
	"encrypted_content" text NOT NULL,
	"encrypted_metadata" text,
	"last_modified_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedule_availabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"day_of_week" "day" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"before_event_buffer" integer DEFAULT 0 NOT NULL,
	"after_event_buffer" integer DEFAULT 0 NOT NULL,
	"minimum_notice" integer DEFAULT 0 NOT NULL,
	"time_slot_interval" integer DEFAULT 15 NOT NULL,
	"booking_window_days" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active',
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_org_unique" UNIQUE("workos_user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_connect_account_id" text,
	"stripe_connect_details_submitted" boolean DEFAULT false,
	"stripe_connect_charges_enabled" boolean DEFAULT false,
	"stripe_connect_payouts_enabled" boolean DEFAULT false,
	"stripe_connect_onboarding_complete" boolean DEFAULT false,
	"stripe_identity_verification_id" text,
	"stripe_identity_verified" boolean DEFAULT false,
	"stripe_identity_verification_status" text,
	"stripe_identity_verification_last_checked" timestamp,
	"country" text DEFAULT 'PT',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_workos_user_id_unique" UNIQUE("workos_user_id"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_connect_account_id_unique" UNIQUE("stripe_connect_account_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_secondary_category_id_categories_id_fk" FOREIGN KEY ("secondary_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_availabilities" ADD CONSTRAINT "schedule_availabilities_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling_settings" ADD CONSTRAINT "scheduling_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_org_memberships" ADD CONSTRAINT "user_org_memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_primary_org_id_organizations_id_fk" FOREIGN KEY ("primary_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_exports_org_id_idx" ON "audit_log_exports" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_exports_created_at_idx" ON "audit_log_exports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_org_id_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_idx" ON "audit_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_org_created_idx" ON "audit_logs" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_stats_org_id_idx" ON "audit_stats" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_stats_date_idx" ON "audit_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_org_id_idx" ON "events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_workos_user_id_idx" ON "events" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_org_id_idx" ON "meetings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_user_id_idx" ON "meetings" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_event_id_idx" ON "meetings" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_payment_intent_id_idx" ON "meetings" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_transfer_id_idx" ON "meetings" USING btree ("stripe_transfer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_workos_org_id_idx" ON "organizations" USING btree ("workos_org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transfers_org_id_idx" ON "payment_transfers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transfers_expert_id_idx" ON "payment_transfers" USING btree ("expert_workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_org_id_idx" ON "profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_workos_user_id_idx" ON "profiles" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_org_id_idx" ON "records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_meeting_id_idx" ON "records" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_expert_id_idx" ON "records" USING btree ("expert_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_availabilities_schedule_id_idx" ON "schedule_availabilities" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedules_org_id_idx" ON "schedules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedules_user_id_idx" ON "schedules" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduling_settings_user_id_idx" ON "scheduling_settings" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_user_id_idx" ON "user_org_memberships" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_org_id_idx" ON "user_org_memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_workos_user_id_idx" ON "users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");