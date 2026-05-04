CREATE TYPE "public"."audit_outbox_status" AS ENUM('pending', 'shipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."become_partner_applicant_type" AS ENUM('solo_expert', 'clinic_admin');--> statement-breakpoint
CREATE TYPE "public"."become_partner_status" AS ENUM('submitted', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."credential_status" AS ENUM('pending', 'active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."expert_status" AS ENUM('draft', 'approved', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."invoicing_provider" AS ENUM('toconline', 'moloni', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoicing_setup_status" AS ENUM('not_started', 'connecting', 'connected', 'manual_acknowledged', 'expired');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('online', 'in_person', 'phone');--> statement-breakpoint
CREATE TYPE "public"."stripe_identity_status" AS ENUM('not_started', 'requires_input', 'processing', 'verified', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('personal', 'solo_expert', 'clinic', 'eleva_operator');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."workos_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "audit_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" text,
	"payload" jsonb NOT NULL,
	"correlation_id" varchar(64),
	"status" "audit_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "become_partner_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"applicant_org_id" uuid NOT NULL,
	"type" "become_partner_applicant_type" NOT NULL,
	"username_requested" varchar(30) NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"nif" varchar(32),
	"license_number" varchar(64),
	"license_scope" text,
	"practice_countries" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"category_slugs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "become_partner_status" DEFAULT 'submitted' NOT NULL,
	"reviewer_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"provisioned_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clinic_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website_url" text,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clinic_profiles_slug_format" CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND slug NOT LIKE '%--%')
);
--> statement-breakpoint
CREATE TABLE "expert_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"display_name" jsonb NOT NULL,
	"description" jsonb,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"provider" "invoicing_provider" NOT NULL,
	"vault_ref" varchar(255) NOT NULL,
	"metadata" jsonb,
	"status" "credential_status" DEFAULT 'pending' NOT NULL,
	"connected_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"last_refresh_at" timestamp with time zone,
	"last_error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expert_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"expert_profile_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"username" varchar(30) NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"bio" text,
	"avatar_url" text,
	"languages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"practice_countries" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"license_scope" text,
	"worldwide_mode" boolean DEFAULT false NOT NULL,
	"nif" varchar(32),
	"session_modes" "session_mode"[] DEFAULT ARRAY['online']::session_mode[] NOT NULL,
	"stripe_account_id" varchar(255),
	"stripe_identity_status" "stripe_identity_status" DEFAULT 'not_started' NOT NULL,
	"invoicing_provider" "invoicing_provider",
	"invoicing_setup_status" "invoicing_setup_status" DEFAULT 'not_started' NOT NULL,
	"top_expert_active" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"status" "expert_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expert_profiles_username_format" CHECK (username ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' AND username NOT LIKE '%--%')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_user_id" varchar(255) NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_org_id" varchar(255) NOT NULL,
	"type" "org_type" NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workos_role" "workos_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invited_at" timestamp with time zone,
	"accepted_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"display_name" text NOT NULL,
	"capability_bundle" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "become_partner_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "become_partner_applications_applicant_org_id_organizations_id_fk" FOREIGN KEY ("applicant_org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "become_partner_applications_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "become_partner_applications" ADD CONSTRAINT "become_partner_applications_provisioned_org_id_organizations_id_fk" FOREIGN KEY ("provisioned_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_profiles" ADD CONSTRAINT "clinic_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_integration_credentials" ADD CONSTRAINT "expert_integration_credentials_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_listings" ADD CONSTRAINT "expert_listings_expert_profile_id_expert_profiles_id_fk" FOREIGN KEY ("expert_profile_id") REFERENCES "public"."expert_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_listings" ADD CONSTRAINT "expert_listings_category_id_expert_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expert_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_outbox_audit_id_idx" ON "audit_outbox" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "become_partner_applications_applicant_idx" ON "become_partner_applications" USING btree ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "become_partner_applications_status_idx" ON "become_partner_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "become_partner_applications_username_idx" ON "become_partner_applications" USING btree ("username_requested");--> statement-breakpoint
CREATE UNIQUE INDEX "become_partner_applications_one_pending" ON "become_partner_applications" USING btree ("applicant_user_id") WHERE status IN ('submitted', 'under_review');--> statement-breakpoint
CREATE UNIQUE INDEX "clinic_profiles_slug_idx" ON "clinic_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "clinic_profiles_org_idx" ON "clinic_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_categories_slug_idx" ON "expert_categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_integration_credentials_expert_provider_unique" ON "expert_integration_credentials" USING btree ("expert_profile_id","provider");--> statement-breakpoint
CREATE INDEX "expert_integration_credentials_expert_idx" ON "expert_integration_credentials" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE INDEX "expert_integration_credentials_status_idx" ON "expert_integration_credentials" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_listings_expert_category_unique" ON "expert_listings" USING btree ("expert_profile_id","category_id");--> statement-breakpoint
CREATE INDEX "expert_listings_category_idx" ON "expert_listings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expert_listings_expert_idx" ON "expert_listings" USING btree ("expert_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expert_profiles_username_idx" ON "expert_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "expert_profiles_org_idx" ON "expert_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "expert_profiles_user_idx" ON "expert_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expert_profiles_status_idx" ON "expert_profiles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_workos_user_id_idx" ON "users" USING btree ("workos_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_workos_org_id_idx" ON "organizations" USING btree ("workos_org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_unique" ON "memberships" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_slug_idx" ON "roles" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_slug_idx" ON "permissions" USING btree ("slug");