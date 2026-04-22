/**
 * Apply RLS to subscription_plans Table
 *
 * This table was missed in the initial RLS migration.
 * subscription_plans is organization-owned (one subscription per org)
 * with billing admin management.
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function applySubscriptionPlansRLS() {
  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;
  const sql = neon(databaseUrl);

  console.log('🔒 Applying RLS to subscription_plans Table...\n');

  try {
    // Step 1: Enable RLS
    console.log('📋 Step 1: Enabling RLS...\n');
    await sql`ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY`;
    console.log('✅ RLS enabled on subscription_plans\n');

    // Step 2: Create policies
    console.log('📋 Step 2: Creating security policies...\n');

    const policies = [
      {
        name: 'Org members can view org subscription',
        sql: `CREATE POLICY "Org members can view org subscription" 
          ON subscription_plans 
          FOR SELECT 
          USING (
            EXISTS (
              SELECT 1 FROM user_org_memberships
              WHERE user_org_memberships.org_id = subscription_plans.org_id
              AND user_org_memberships.workos_user_id = auth.user_id()
              AND user_org_memberships.status = 'active'
            )
          )`,
      },
      {
        name: 'Billing admin can update subscription',
        sql: `CREATE POLICY "Billing admin can update subscription" 
          ON subscription_plans 
          FOR UPDATE 
          USING (
            billing_admin_user_id = auth.user_id()
            OR EXISTS (
              SELECT 1 FROM user_org_memberships
              WHERE user_org_memberships.org_id = subscription_plans.org_id
              AND user_org_memberships.workos_user_id = auth.user_id()
              AND user_org_memberships.role IN ('owner', 'admin')
              AND user_org_memberships.status = 'active'
            )
          )
          WITH CHECK (
            billing_admin_user_id = auth.user_id()
            OR EXISTS (
              SELECT 1 FROM user_org_memberships
              WHERE user_org_memberships.org_id = subscription_plans.org_id
              AND user_org_memberships.workos_user_id = auth.user_id()
              AND user_org_memberships.role IN ('owner', 'admin')
              AND user_org_memberships.status = 'active'
            )
          )`,
      },
      {
        name: 'Org owners can insert subscription',
        sql: `CREATE POLICY "Org owners can insert subscription" 
          ON subscription_plans 
          FOR INSERT 
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM user_org_memberships
              WHERE user_org_memberships.org_id = subscription_plans.org_id
              AND user_org_memberships.workos_user_id = auth.user_id()
              AND user_org_memberships.role IN ('owner', 'admin')
              AND user_org_memberships.status = 'active'
            )
          )`,
      },
      {
        name: 'Org owners can delete subscription',
        sql: `CREATE POLICY "Org owners can delete subscription" 
          ON subscription_plans 
          FOR DELETE 
          USING (
            EXISTS (
              SELECT 1 FROM user_org_memberships
              WHERE user_org_memberships.org_id = subscription_plans.org_id
              AND user_org_memberships.workos_user_id = auth.user_id()
              AND user_org_memberships.role = 'owner'
              AND user_org_memberships.status = 'active'
            )
          )`,
      },
      {
        name: 'Admins can view all subscriptions',
        sql: `CREATE POLICY "Admins can view all subscriptions" 
          ON subscription_plans 
          FOR SELECT 
          USING (
            EXISTS (
              SELECT 1 FROM users
              WHERE users.workos_user_id = auth.user_id()
              AND users.role IN ('admin', 'superadmin')
            )
          )`,
      },
    ];

    let successCount = 0;
    for (const policy of policies) {
      try {
        await sql(policy.sql);
        console.log(`✅ Created: "${policy.name}"`);
        successCount++;
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⚠️  Already exists: "${policy.name}"`);
        } else {
          console.error(`❌ Error creating "${policy.name}":`, error.message);
        }
      }
    }

    console.log(`\n📊 Created ${successCount} policies\n`);

    // Verification
    console.log('🔍 Verification:\n');

    const rlsStatus = await sql`
      SELECT tablename, rowsecurity as "rls_enabled"
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'subscription_plans'
    `;
    console.log('RLS Status:');
    console.table(rlsStatus);

    const policyCounts = await sql`
      SELECT COUNT(*) as "policy_count"
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'subscription_plans'
    `;
    console.log('\nPolicy Count:');
    console.table(policyCounts);

    const allPolicies = await sql`
      SELECT policyname, cmd as "operation"
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'subscription_plans'
      ORDER BY policyname
    `;
    console.log('\nAll Policies:');
    console.table(allPolicies);

    console.log('\n✅ subscription_plans RLS Applied Successfully!');
    console.log('\n📝 Policies Created:');
    console.log('   1. Org members can view org subscription (SELECT)');
    console.log('   2. Billing admin can update subscription (UPDATE)');
    console.log('   3. Org owners can insert subscription (INSERT)');
    console.log('   4. Org owners can delete subscription (DELETE)');
    console.log('   5. Admins can view all subscriptions (SELECT)');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

applySubscriptionPlansRLS();
