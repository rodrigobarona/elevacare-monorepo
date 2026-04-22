CREATE TABLE IF NOT EXISTS "expert_setup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid,
	"profile_completed" boolean DEFAULT false NOT NULL,
	"availability_completed" boolean DEFAULT false NOT NULL,
	"events_completed" boolean DEFAULT false NOT NULL,
	"identity_completed" boolean DEFAULT false NOT NULL,
	"payment_completed" boolean DEFAULT false NOT NULL,
	"google_account_completed" boolean DEFAULT false NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"setup_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expert_setup_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" text NOT NULL,
	"org_id" uuid,
	"security_alerts" boolean DEFAULT true NOT NULL,
	"new_device_alerts" boolean DEFAULT false NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"in_app_notifications" boolean DEFAULT true NOT NULL,
	"unusual_timing_alerts" boolean DEFAULT true NOT NULL,
	"location_change_alerts" boolean DEFAULT true NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_workos_user_id_unique" UNIQUE("workos_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_setup" ADD CONSTRAINT "expert_setup_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expert_setup" ADD CONSTRAINT "expert_setup_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_workos_user_id_users_workos_user_id_fk" FOREIGN KEY ("workos_user_id") REFERENCES "public"."users"("workos_user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_setup_user_id_idx" ON "expert_setup" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_setup_org_id_idx" ON "expert_setup" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expert_setup_complete_idx" ON "expert_setup" USING btree ("setup_complete");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_preferences_user_id_idx" ON "user_preferences" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_preferences_org_id_idx" ON "user_preferences" USING btree ("org_id");