CREATE TYPE "public"."integration_category" AS ENUM('calendar', 'invoicing', 'crm', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."integration_connect_type" AS ENUM('pipes', 'oauth', 'api_key', 'manual');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('connecting', 'connected', 'disconnected', 'error', 'expired');--> statement-breakpoint
CREATE TABLE "expert_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"category" "integration_category" NOT NULL,
	"slug" text NOT NULL,
	"connect_type" "integration_connect_type" NOT NULL,
	"workos_user_id" text,
	"vault_ref" varchar(255),
	"account_identifier" text,
	"metadata" jsonb,
	"status" "integration_status" DEFAULT 'connecting' NOT NULL,
	"connected_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_refresh_at" timestamp with time zone,
	"last_error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expert_integrations_pipes_check" CHECK (connect_type != 'pipes' OR workos_user_id IS NOT NULL),
	CONSTRAINT "expert_integrations_oauth_check" CHECK (connect_type != 'oauth' OR vault_ref IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "expert_integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connected_calendars" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expert_integration_credentials" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "connected_calendars_tenant_isolation" ON "connected_calendars" CASCADE;--> statement-breakpoint
DROP TABLE "connected_calendars" CASCADE;--> statement-breakpoint
DROP POLICY "expert_integration_credentials_tenant_isolation" ON "expert_integration_credentials" CASCADE;--> statement-breakpoint
DROP TABLE "expert_integration_credentials" CASCADE;--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" DROP CONSTRAINT "calendar_busy_sources_connected_calendar_id_connected_calendars_id_fk";
--> statement-breakpoint
ALTER TABLE "calendar_destinations" DROP CONSTRAINT "calendar_destinations_connected_calendar_id_connected_calendars_id_fk";
--> statement-breakpoint
DROP INDEX "calendar_busy_sources_connected_idx";--> statement-breakpoint
DROP INDEX "calendar_busy_sources_unique_idx";--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" ADD COLUMN "expert_integration_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD COLUMN "expert_integration_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expert_integrations_org_idx" ON "expert_integrations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expert_integrations_expert_idx" ON "expert_integrations" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "expert_integrations_category_idx" ON "expert_integrations" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_integrations_expert_slug_idx" ON "expert_integrations" USING btree ("expert_profile_id","slug");--> statement-breakpoint
CREATE INDEX "expert_integrations_status_idx" ON "expert_integrations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" ADD CONSTRAINT "calendar_busy_sources_expert_integration_id_expert_integrations_id_fk" FOREIGN KEY ("expert_integration_id") REFERENCES "public"."expert_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "calendar_destinations_expert_integration_id_expert_integrations_id_fk" FOREIGN KEY ("expert_integration_id") REFERENCES "public"."expert_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_busy_sources_integration_idx" ON "calendar_busy_sources" USING btree ("expert_integration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_busy_sources_unique_idx" ON "calendar_busy_sources" USING btree ("expert_integration_id","external_calendar_id");--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" DROP COLUMN "connected_calendar_id";--> statement-breakpoint
ALTER TABLE "calendar_destinations" DROP COLUMN "connected_calendar_id";--> statement-breakpoint
CREATE POLICY "expert_integrations_tenant_isolation" ON "expert_integrations" AS PERMISSIVE FOR ALL TO public USING (org_id::text = current_setting('eleva.org_id', true)) WITH CHECK (org_id::text = current_setting('eleva.org_id', true));--> statement-breakpoint
DROP TYPE "public"."calendar_connection_status";--> statement-breakpoint
DROP TYPE "public"."calendar_provider";--> statement-breakpoint
DROP TYPE "public"."credential_status";