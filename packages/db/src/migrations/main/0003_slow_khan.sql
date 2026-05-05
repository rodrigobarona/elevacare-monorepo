CREATE TYPE "public"."booking_status" AS ENUM('slot_reserved', 'awaiting_payment', 'awaiting_confirmation', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."slot_reservation_status" AS ENUM('active', 'expired', 'converted', 'released');--> statement-breakpoint
CREATE TYPE "public"."calendar_connection_status" AS ENUM('connecting', 'connected', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"status" "booking_status" DEFAULT 'slot_reserved' NOT NULL,
	"session_mode" "session_mode" NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"booked_locale" varchar(5),
	"stripe_payment_intent_id" varchar(255),
	"rescheduled_from_id" uuid,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"session_mode" "session_mode" NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"daily_room_url" text,
	"daily_room_name" varchar(255),
	"calendar_event_id" varchar(255),
	"transcript_vault_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "slot_reservation_status" DEFAULT 'active' NOT NULL,
	"booking_id" uuid,
	"hold_token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_busy_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"connected_calendar_id" uuid NOT NULL,
	"external_calendar_id" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"connected_calendar_id" uuid NOT NULL,
	"external_calendar_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"account_email" text NOT NULL,
	"status" "calendar_connection_status" DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" varchar(2) NOT NULL,
	"postal_code" varchar(20),
	"instructions" jsonb,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_practice_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" varchar(2) NOT NULL,
	"postal_code" varchar(20),
	"latitude" double precision,
	"longitude" double precision,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"schedule_id" uuid,
	"slug" varchar(50) NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"price_amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'eur' NOT NULL,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"session_mode" "session_mode" DEFAULT 'online' NOT NULL,
	"booking_window_days" integer,
	"minimum_notice_minutes" integer DEFAULT 60 NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"cancellation_window_hours" integer,
	"reschedule_window_hours" integer,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"worldwide_mode" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "event_types_slug_format" CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$' AND slug NOT LIKE '%--%')
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_rules_day_range" CHECK (day_of_week >= 0 AND day_of_week <= 6),
	CONSTRAINT "availability_rules_time_order" CHECK (start_time < end_time)
);
--> statement-breakpoint
CREATE TABLE "date_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"override_date" text NOT NULL,
	"start_time" time,
	"end_time" time,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "date_overrides_blocked_nulls" CHECK ((is_blocked = true AND start_time IS NULL AND end_time IS NULL) OR (is_blocked = false AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time))
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_bookings_id_fk" FOREIGN KEY ("rescheduled_from_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_patient_user_id_users_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" ADD CONSTRAINT "calendar_busy_sources_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" ADD CONSTRAINT "calendar_busy_sources_connected_calendar_id_connected_calendars_id_fk" FOREIGN KEY ("connected_calendar_id") REFERENCES "public"."connected_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_connected_calendar_id_connected_calendars_id_fk" FOREIGN KEY ("connected_calendar_id") REFERENCES "public"."connected_calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_calendars" ADD CONSTRAINT "connected_calendars_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_calendars" ADD CONSTRAINT "connected_calendars_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_locations" ADD CONSTRAINT "event_locations_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD CONSTRAINT "expert_practice_locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD CONSTRAINT "expert_practice_locations_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_overrides" ADD CONSTRAINT "date_overrides_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_org_idx" ON "bookings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "bookings_expert_idx" ON "bookings" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "bookings_patient_idx" ON "bookings" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_time_idx" ON "bookings" USING btree ("expert_profile_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_payment_idx" ON "bookings" USING btree ("stripe_payment_intent_id") WHERE stripe_payment_intent_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sessions_org_idx" ON "sessions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "sessions_booking_idx" ON "sessions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "sessions_expert_idx" ON "sessions" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "sessions_patient_idx" ON "sessions" USING btree ("patient_user_id");--> statement-breakpoint
CREATE INDEX "sessions_time_idx" ON "sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "slot_reservations_org_idx" ON "slot_reservations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "slot_reservations_expert_idx" ON "slot_reservations" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "slot_reservations_active_idx" ON "slot_reservations" USING btree ("expert_profile_id","starts_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "slot_reservations_hold_idx" ON "slot_reservations" USING btree ("hold_token");--> statement-breakpoint
CREATE INDEX "slot_reservations_expires_active_idx" ON "slot_reservations" USING btree ("expires_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "calendar_busy_sources_org_idx" ON "calendar_busy_sources" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "calendar_busy_sources_connected_idx" ON "calendar_busy_sources" USING btree ("connected_calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_busy_sources_unique_idx" ON "calendar_busy_sources" USING btree ("connected_calendar_id","external_calendar_id");--> statement-breakpoint
CREATE INDEX "calendar_destinations_org_idx" ON "calendar_destinations" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_destinations_expert_idx" ON "calendar_destinations" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "connected_calendars_org_idx" ON "connected_calendars" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "connected_calendars_expert_idx" ON "connected_calendars" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_calendars_expert_provider_email_idx" ON "connected_calendars" USING btree ("expert_profile_id","provider","account_email");--> statement-breakpoint
CREATE INDEX "event_locations_org_idx" ON "event_locations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "event_locations_event_type_idx" ON "event_locations" USING btree ("event_type_id");--> statement-breakpoint
CREATE INDEX "expert_practice_locations_org_idx" ON "expert_practice_locations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expert_practice_locations_expert_idx" ON "expert_practice_locations" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_practice_locations_primary_idx" ON "expert_practice_locations" USING btree ("expert_profile_id") WHERE is_primary = true;--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_expert_slug_idx" ON "event_types" USING btree ("expert_profile_id","slug");--> statement-breakpoint
CREATE INDEX "event_types_org_idx" ON "event_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "event_types_expert_idx" ON "event_types" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "event_types_published_idx" ON "event_types" USING btree ("published","active");--> statement-breakpoint
CREATE INDEX "availability_rules_org_idx" ON "availability_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "availability_rules_schedule_idx" ON "availability_rules" USING btree ("schedule_id");--> statement-breakpoint
CREATE INDEX "date_overrides_org_idx" ON "date_overrides" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "date_overrides_schedule_idx" ON "date_overrides" USING btree ("schedule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "date_overrides_schedule_date_idx" ON "date_overrides" USING btree ("schedule_id","override_date");--> statement-breakpoint
CREATE INDEX "schedules_org_idx" ON "schedules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "schedules_expert_idx" ON "schedules" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_expert_default_idx" ON "schedules" USING btree ("expert_profile_id","is_default") WHERE is_default = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "expert_profiles_search_idx" ON "expert_profiles" USING gin ("search_vector");