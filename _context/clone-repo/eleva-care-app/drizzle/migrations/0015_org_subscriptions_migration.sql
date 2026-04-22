-- Migration: Organization-owned Subscriptions (Industry Standard)
-- Date: 2025-02-06
-- Changes subscription ownership from user-centric to org-centric

-- Step 1: Drop the unique constraint on workos_user_id (allow multiple subscriptions with same billing admin)
ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_workos_user_id_unique";

-- Step 2: Rename column for clarity (workos_user_id → billing_admin_user_id)
ALTER TABLE "subscription_plans" RENAME COLUMN "workos_user_id" TO "billing_admin_user_id";

-- Step 3: Add unique constraint on org_id (ensure one subscription per organization)
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_org_id_unique" UNIQUE("org_id");

-- Step 4: Drop old foreign key constraint on user
ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_workos_user_id_users_workos_user_id_fk";

-- Step 5: Add new foreign key with RESTRICT (don't delete subscription if billing admin leaves)
ALTER TABLE "subscription_plans" 
  ADD CONSTRAINT "subscription_plans_billing_admin_user_id_users_workos_user_id_fk" 
  FOREIGN KEY ("billing_admin_user_id") REFERENCES "users"("workos_user_id") ON DELETE RESTRICT;

-- Step 6: Update index name to match new column
DROP INDEX IF EXISTS "subscription_plans_user_id_idx";
CREATE INDEX IF NOT EXISTS "subscription_plans_billing_admin_idx" ON "subscription_plans" ("billing_admin_user_id");

-- Step 7: Verify data integrity - ensure all subscriptions have valid org_id
-- This update should be a no-op if data is already correct, but it's here as a safeguard
UPDATE "subscription_plans" sp
SET "org_id" = (
  SELECT "org_id" 
  FROM "user_org_memberships" 
  WHERE "workos_user_id" = sp."billing_admin_user_id" 
  LIMIT 1
)
WHERE "org_id" IS NULL;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN "subscription_plans"."org_id" IS 'Primary owner: Organization that owns this subscription (one subscription per org)';
COMMENT ON COLUMN "subscription_plans"."billing_admin_user_id" IS 'Secondary: User who manages the subscription billing (can be transferred)';
COMMENT ON CONSTRAINT "subscription_plans_org_id_unique" ON "subscription_plans" IS 'Ensures one subscription per organization (industry standard pattern)';
COMMENT ON CONSTRAINT "subscription_plans_billing_admin_user_id_users_workos_user_id_fk" ON "subscription_plans" IS 'Uses RESTRICT to prevent subscription deletion if billing admin leaves';

