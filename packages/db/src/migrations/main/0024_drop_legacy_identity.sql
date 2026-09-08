-- Phase 03.2 contract: drop leftover identity tables and every leftover
-- identity-provider column. Tenant FKs already point at auth.organization /
-- auth.user from 0022; DROP TABLE CASCADE only removes the old main.* FKs.

ALTER TABLE "billing_customers" DROP COLUMN IF EXISTS "workos_org_id";
--> statement-breakpoint
ALTER TABLE "expert_integrations" DROP CONSTRAINT IF EXISTS "expert_integrations_pipes_check";
--> statement-breakpoint
ALTER TABLE "expert_integrations" DROP COLUMN IF EXISTS "workos_user_id";
--> statement-breakpoint
ALTER TABLE "expert_integrations" ADD CONSTRAINT "expert_integrations_pipes_check"
  CHECK (connect_type != 'pipes' OR auth_account_id IS NOT NULL);
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_users" ON "users"';
  END IF;
  IF to_regclass('public.organizations') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_organizations" ON "organizations"';
  END IF;
  IF to_regclass('public.memberships') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "forbid_legacy_identity_write_memberships" ON "memberships"';
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS auth.forbid_legacy_identity_write();
--> statement-breakpoint
DROP TABLE IF EXISTS "memberships" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "organizations" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "roles" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "permissions" CASCADE;
--> statement-breakpoint
DROP TYPE IF EXISTS "workos_role";
