ALTER TABLE "become_partner_applications" DROP CONSTRAINT "become_partner_applications_applicant_org_id_organizations_id_f";
--> statement-breakpoint
ALTER TABLE "become_partner_applications" DROP CONSTRAINT "become_partner_applications_provisioned_org_id_organizations_id";
--> statement-breakpoint
ALTER TABLE "expert_practice_locations" DROP CONSTRAINT "expert_practice_locations_expert_profile_id_expert_profiles_id_";
--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" DROP CONSTRAINT "calendar_busy_sources_expert_integration_id_expert_integrations";
--> statement-breakpoint
ALTER TABLE "calendar_destinations" DROP CONSTRAINT "calendar_destinations_expert_integration_id_expert_integrations";
--> statement-breakpoint
DROP INDEX "expert_profiles_name_trgm_idx";--> statement-breakpoint
ALTER TABLE "become_partner_applications" ALTER COLUMN "practice_countries" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "become_partner_applications" ALTER COLUMN "languages" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "become_partner_applications" ALTER COLUMN "category_slugs" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "event_types" ALTER COLUMN "languages" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "languages" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "practice_countries" SET DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "expert_profiles" ALTER COLUMN "session_modes" SET DEFAULT '{online}'::session_mode[];--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "bpa_applicant_org_fk" FOREIGN KEY ("applicant_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "bpa_provisioned_org_fk" FOREIGN KEY ("provisioned_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_practice_locations" ADD CONSTRAINT "practice_loc_expert_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_busy_sources" ADD CONSTRAINT "cal_busy_src_integration_fk" FOREIGN KEY ("expert_integration_id") REFERENCES "public"."expert_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_destinations" ADD CONSTRAINT "cal_dest_integration_fk" FOREIGN KEY ("expert_integration_id") REFERENCES "public"."expert_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expert_profiles_name_trgm_idx" ON "expert_profiles" USING gin ("display_name" gin_trgm_ops);