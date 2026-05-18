CREATE TYPE "public"."stripe_subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."stripe_webhook_event_status" AS ENUM('received', 'processed', 'failed', 'ignored');--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"workos_org_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"tier" varchar(64) DEFAULT 'unknown' NOT NULL,
	"status" "stripe_subscription_status" NOT NULL,
	"price_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"seat_item_id" varchar(255),
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"livemode" boolean NOT NULL,
	"api_version" varchar(32),
	"event_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" "stripe_webhook_event_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"resolved_org_id" uuid
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_org_idx" ON "billing_customers" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customers_stripe_idx" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_customers_workos_idx" ON "billing_customers" USING btree ("workos_org_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_org_idx" ON "billing_subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_stripe_idx" ON "billing_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_customer_idx" ON "billing_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_type_idx" ON "stripe_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_received_idx" ON "stripe_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_status_idx" ON "stripe_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE POLICY "billing_customers_tenant_isolation" ON "billing_customers" AS PERMISSIVE FOR ALL TO public USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true') WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');--> statement-breakpoint
CREATE POLICY "billing_subscriptions_tenant_isolation" ON "billing_subscriptions" AS PERMISSIVE FOR ALL TO public USING (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true') WITH CHECK (org_id::text = current_setting('eleva.org_id', true) OR current_setting('eleva.platform_admin', true) = 'true');
