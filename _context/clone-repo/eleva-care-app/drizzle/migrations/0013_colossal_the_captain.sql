CREATE TABLE IF NOT EXISTS "annual_plan_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"months_active" integer DEFAULT 0,
	"total_bookings" integer DEFAULT 0,
	"bookings_last_90_days" integer DEFAULT 0,
	"avg_monthly_revenue" integer DEFAULT 0,
	"total_commissions_paid" integer DEFAULT 0,
	"commissions_last_90_days" integer DEFAULT 0,
	"current_rating" integer,
	"is_eligible" boolean DEFAULT false,
	"eligible_since" timestamp,
	"tier_level" text,
	"projected_annual_commissions" integer,
	"projected_annual_savings" integer,
	"savings_percentage" integer,
	"break_even_monthly_revenue" integer,
	"last_calculated" timestamp DEFAULT now() NOT NULL,
	"calculation_version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "annual_plan_eligibility_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"subscription_plan_id" uuid,
	"event_type" text NOT NULL,
	"previous_plan_type" text,
	"new_plan_type" text,
	"previous_tier_level" text,
	"new_tier_level" text,
	"stripe_event_id" text,
	"stripe_subscription_id" text,
	"metadata" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_type" text NOT NULL,
	"tier_level" text NOT NULL,
	"commission_rate" integer,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"stripe_price_id" text,
	"annual_fee" integer,
	"subscription_start_date" timestamp,
	"subscription_end_date" timestamp,
	"subscription_status" text,
	"auto_renew" boolean DEFAULT true,
	"previous_plan_type" text,
	"upgraded_at" timestamp,
	"commissions_paid_before_upgrade" integer,
	"is_eligible_for_annual" boolean DEFAULT false,
	"eligibility_notification_sent" boolean DEFAULT false,
	"eligibility_last_checked" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_workos_user_id_unique" UNIQUE("workos_user_id"),
	CONSTRAINT "subscription_plans_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"gross_amount" integer NOT NULL,
	"commission_rate" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"currency" text DEFAULT 'eur' NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"stripe_transfer_id" text,
	"stripe_application_fee_id" text,
	"status" text NOT NULL,
	"processed_at" timestamp,
	"refunded_at" timestamp,
	"plan_type_at_transaction" text,
	"tier_level_at_transaction" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "annual_plan_eligibility" ADD CONSTRAINT "annual_plan_eligibility_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "annual_plan_eligibility" ADD CONSTRAINT "annual_plan_eligibility_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_commissions" ADD CONSTRAINT "transaction_commissions_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_commissions" ADD CONSTRAINT "transaction_commissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_commissions" ADD CONSTRAINT "transaction_commissions_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_commissions" ADD CONSTRAINT "transaction_commissions_stripe_payment_intent_id_meetings_stripe_payment_intent_id_fk" FOREIGN KEY ("stripe_payment_intent_id") REFERENCES "public"."meetings"("stripe_payment_intent_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annual_eligibility_user_id_idx" ON "annual_plan_eligibility" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annual_eligibility_org_id_idx" ON "annual_plan_eligibility" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annual_eligibility_eligible_idx" ON "annual_plan_eligibility" USING btree ("is_eligible");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "annual_eligibility_last_calc_idx" ON "annual_plan_eligibility" USING btree ("last_calculated");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_events_user_id_idx" ON "subscription_events" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_events_org_id_idx" ON "subscription_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_events_plan_id_idx" ON "subscription_events" USING btree ("subscription_plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_events_type_idx" ON "subscription_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_events_created_at_idx" ON "subscription_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_user_id_idx" ON "subscription_plans" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_org_id_idx" ON "subscription_plans" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_stripe_sub_idx" ON "subscription_plans" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_plan_type_idx" ON "subscription_plans" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_user_id_idx" ON "transaction_commissions" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_org_id_idx" ON "transaction_commissions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_meeting_id_idx" ON "transaction_commissions" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_status_idx" ON "transaction_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_created_at_idx" ON "transaction_commissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_commissions_payment_intent_idx" ON "transaction_commissions" USING btree ("stripe_payment_intent_id");