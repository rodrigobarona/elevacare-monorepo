-- Drop RLS policies that depend on expert_workos_user_id
DROP POLICY IF EXISTS payment_transfers_modify ON payment_transfers;
--> statement-breakpoint

-- Drop unused tables
DROP TABLE "audit_log_exports" CASCADE;--> statement-breakpoint
DROP TABLE "audit_stats" CASCADE;--> statement-breakpoint

-- Drop unused unique constraints
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_stripe_application_fee_id_unique";--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_stripe_refund_id_unique";--> statement-breakpoint
ALTER TABLE "user_org_memberships" DROP CONSTRAINT "user_org_memberships_workos_org_membership_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_primary_org_id_organizations_id_fk";
--> statement-breakpoint

-- Fix index on payment_transfers
DROP INDEX IF EXISTS "payment_transfers_expert_id_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transfers_expert_id_idx" ON "payment_transfers" USING btree ("expert_connect_account_id");--> statement-breakpoint

-- Drop unused columns from meetings
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_application_fee_id";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_refund_id";--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN IF EXISTS "stripe_metadata";--> statement-breakpoint

-- Drop unused columns from organizations
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "features";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscription_tier";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "subscription_status";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "billing_email";--> statement-breakpoint

-- Drop unused column from payment_transfers (after dropping the policy)
ALTER TABLE "payment_transfers" DROP COLUMN IF EXISTS "expert_workos_user_id";--> statement-breakpoint

-- Drop unused columns from user_org_memberships
ALTER TABLE "user_org_memberships" DROP COLUMN IF EXISTS "workos_org_membership_id";--> statement-breakpoint

-- Drop unused columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "primary_org_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "platform_role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_bank_account_last4";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_bank_name";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "welcome_email_sent_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "onboarding_completed_at";--> statement-breakpoint

-- Recreate payment_transfers_modify policy using org-based access
-- This is more appropriate since payment transfers are org-scoped
CREATE POLICY payment_transfers_modify ON payment_transfers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_org_memberships
    WHERE user_org_memberships.org_id = payment_transfers.org_id
    AND user_org_memberships.workos_user_id = auth.user_id()
    AND user_org_memberships.role IN ('owner', 'admin')
  )
);
