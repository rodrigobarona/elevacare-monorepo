CREATE TABLE IF NOT EXISTS "expert_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"expertise" text NOT NULL,
	"credentials" text NOT NULL,
	"experience" text NOT NULL,
	"motivation" text NOT NULL,
	"hourly_rate" integer,
	"website" text,
	"linkedin" text,
	"resume" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_active_expert_application" UNIQUE("workos_user_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_workos_user_id_unique";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_workos_user_id_users_workos_user_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "subscription_plans_user_id_idx";--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "vault_encrypted_content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "vault_encrypted_metadata" text;--> statement-breakpoint
ALTER TABLE "records" ADD COLUMN "encryption_method" text DEFAULT 'vault' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "billing_admin_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vault_google_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vault_google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_token_encryption_method" text DEFAULT 'vault';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_scopes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_applications" ADD CONSTRAINT "expert_applications_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_workos_user_id_idx" ON "expert_applications" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_status_idx" ON "expert_applications" USING btree ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_billing_admin_user_id_users_workos_user_id_fk" FOREIGN KEY ("billing_admin_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_billing_admin_idx" ON "subscription_plans" USING btree ("billing_admin_user_id");--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN IF EXISTS "encrypted_content";--> statement-breakpoint
ALTER TABLE "records" DROP COLUMN IF EXISTS "encrypted_metadata";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "workos_user_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_access_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_refresh_token";--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_org_id_unique" UNIQUE("org_id");