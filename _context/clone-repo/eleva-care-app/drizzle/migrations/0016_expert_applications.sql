-- Migration: Add Expert Applications Table
-- Purpose: Manual review system for expert applications (Airbnb-style vetting)
-- Date: 2025-11-08

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
DO $$ BEGIN
 ALTER TABLE "expert_applications" ADD CONSTRAINT "expert_applications_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_workos_user_id_idx" ON "expert_applications" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_applications_status_idx" ON "expert_applications" USING btree ("status");

