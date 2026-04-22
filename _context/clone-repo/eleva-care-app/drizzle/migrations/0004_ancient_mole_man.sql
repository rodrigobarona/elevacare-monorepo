CREATE TABLE IF NOT EXISTS "blocked_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"workos_user_id" text NOT NULL,
	"date" date NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "slot_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"event_id" uuid NOT NULL,
	"workos_user_id" text NOT NULL,
	"guest_email" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_session_id" text,
	"gentle_reminder_sent_at" timestamp,
	"urgent_reminder_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slot_reservations_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "slot_reservations_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transfers" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduling_settings" ALTER COLUMN "org_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "guest_workos_user_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "guest_org_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD COLUMN "expert_clerk_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_bank_account_last4" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_bank_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "welcome_email_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "blocked_dates" ADD CONSTRAINT "blocked_dates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_dates_org_id_idx" ON "blocked_dates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_dates_user_id_idx" ON "blocked_dates" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocked_dates_date_idx" ON "blocked_dates" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slot_reservations_org_id_idx" ON "slot_reservations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slot_reservations_event_id_idx" ON "slot_reservations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slot_reservations_user_id_idx" ON "slot_reservations" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slot_reservations_expires_at_idx" ON "slot_reservations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "slot_reservations_payment_intent_id_idx" ON "slot_reservations" USING btree ("stripe_payment_intent_id");