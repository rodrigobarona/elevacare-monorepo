/**
 * Apply RLS Migration - Clean Version
 *
 * This script applies RLS policies by executing each statement individually
 * to avoid SQL parsing issues with comments.
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function applyRLSMigration() {
  console.log('🔒 Applying RLS Migration for Missing Tables...\n');

  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_DEV_URL or DATABASE_URL not set');
    process.exit(1);
  }

  console.log('📡 Connecting to Neon database...');
  const sql = neon(databaseUrl);

  try {
    // Step 1: Enable RLS on all tables
    console.log('\n📋 Step 1: Enabling RLS on tables...\n');

    const tables = [
      'annual_plan_eligibility',
      'blocked_dates',
      'expert_applications',
      'roles',
      'slot_reservations',
      'subscription_events',
      'transaction_commissions',
    ];

    for (const table of tables) {
      try {
        await sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        console.log(`✅ Enabled RLS on: ${table}`);
      } catch (error: any) {
        if (error.message?.includes('already enabled')) {
          console.log(`⚠️  RLS already enabled on: ${table}`);
        } else {
          console.error(`❌ Error enabling RLS on ${table}:`, error.message);
        }
      }
    }

    // Step 2: Create all policies
    console.log('\n📋 Step 2: Creating security policies...\n');

    const policies = [
      // annual_plan_eligibility (4 policies)
      {
        name: 'Users can view own eligibility',
        table: 'annual_plan_eligibility',
        sql: `CREATE POLICY "Users can view own eligibility" ON annual_plan_eligibility FOR SELECT USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can create own eligibility',
        table: 'annual_plan_eligibility',
        sql: `CREATE POLICY "Users can create own eligibility" ON annual_plan_eligibility FOR INSERT WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can update own eligibility',
        table: 'annual_plan_eligibility',
        sql: `CREATE POLICY "Users can update own eligibility" ON annual_plan_eligibility FOR UPDATE USING (workos_user_id = auth.user_id()) WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Org members can view org eligibility',
        table: 'annual_plan_eligibility',
        sql: `CREATE POLICY "Org members can view org eligibility" ON annual_plan_eligibility FOR SELECT USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = annual_plan_eligibility.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },

      // blocked_dates (5 policies)
      {
        name: 'Users can view own blocked dates',
        table: 'blocked_dates',
        sql: `CREATE POLICY "Users can view own blocked dates" ON blocked_dates FOR SELECT USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can create own blocked dates',
        table: 'blocked_dates',
        sql: `CREATE POLICY "Users can create own blocked dates" ON blocked_dates FOR INSERT WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can update own blocked dates',
        table: 'blocked_dates',
        sql: `CREATE POLICY "Users can update own blocked dates" ON blocked_dates FOR UPDATE USING (workos_user_id = auth.user_id()) WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can delete own blocked dates',
        table: 'blocked_dates',
        sql: `CREATE POLICY "Users can delete own blocked dates" ON blocked_dates FOR DELETE USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Org members can view org blocked dates',
        table: 'blocked_dates',
        sql: `CREATE POLICY "Org members can view org blocked dates" ON blocked_dates FOR SELECT USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = blocked_dates.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },

      // expert_applications (5 policies)
      {
        name: 'Users can view own application',
        table: 'expert_applications',
        sql: `CREATE POLICY "Users can view own application" ON expert_applications FOR SELECT USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can create own application',
        table: 'expert_applications',
        sql: `CREATE POLICY "Users can create own application" ON expert_applications FOR INSERT WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Users can update own application',
        table: 'expert_applications',
        sql: `CREATE POLICY "Users can update own application" ON expert_applications FOR UPDATE USING (workos_user_id = auth.user_id() AND status IN ('pending', 'rejected')) WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Admins can view all applications',
        table: 'expert_applications',
        sql: `CREATE POLICY "Admins can view all applications" ON expert_applications FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },
      {
        name: 'Admins can update applications',
        table: 'expert_applications',
        sql: `CREATE POLICY "Admins can update applications" ON expert_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin'))) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },

      // roles (5 policies)
      {
        name: 'Users can view own roles',
        table: 'roles',
        sql: `CREATE POLICY "Users can view own roles" ON roles FOR SELECT USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Admins can view all roles',
        table: 'roles',
        sql: `CREATE POLICY "Admins can view all roles" ON roles FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },
      {
        name: 'Admins can insert roles',
        table: 'roles',
        sql: `CREATE POLICY "Admins can insert roles" ON roles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },
      {
        name: 'Admins can update roles',
        table: 'roles',
        sql: `CREATE POLICY "Admins can update roles" ON roles FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin'))) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },
      {
        name: 'Admins can delete roles',
        table: 'roles',
        sql: `CREATE POLICY "Admins can delete roles" ON roles FOR DELETE USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },

      // slot_reservations (6 policies)
      {
        name: 'Users can view own reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Users can view own reservations" ON slot_reservations FOR SELECT USING (guest_email = (SELECT email FROM users WHERE workos_user_id = auth.user_id()))`,
      },
      {
        name: 'Experts can view event reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Experts can view event reservations" ON slot_reservations FOR SELECT USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Experts can create event reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Experts can create event reservations" ON slot_reservations FOR INSERT WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Experts can update event reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Experts can update event reservations" ON slot_reservations FOR UPDATE USING (workos_user_id = auth.user_id()) WITH CHECK (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Experts can delete event reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Experts can delete event reservations" ON slot_reservations FOR DELETE USING (workos_user_id = auth.user_id())`,
      },
      {
        name: 'Org members can view org reservations',
        table: 'slot_reservations',
        sql: `CREATE POLICY "Org members can view org reservations" ON slot_reservations FOR SELECT USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = slot_reservations.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },

      // subscription_events (3 policies)
      {
        name: 'Users can view org subscription events',
        table: 'subscription_events',
        sql: `CREATE POLICY "Users can view org subscription events" ON subscription_events FOR SELECT USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = subscription_events.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },
      {
        name: 'System can insert subscription events',
        table: 'subscription_events',
        sql: `CREATE POLICY "System can insert subscription events" ON subscription_events FOR INSERT WITH CHECK (auth.user_id() IS NOT NULL)`,
      },
      {
        name: 'Admins can view all subscription events',
        table: 'subscription_events',
        sql: `CREATE POLICY "Admins can view all subscription events" ON subscription_events FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },

      // transaction_commissions (4 policies)
      {
        name: 'Users can view org commissions',
        table: 'transaction_commissions',
        sql: `CREATE POLICY "Users can view org commissions" ON transaction_commissions FOR SELECT USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = transaction_commissions.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },
      {
        name: 'System can insert commissions',
        table: 'transaction_commissions',
        sql: `CREATE POLICY "System can insert commissions" ON transaction_commissions FOR INSERT WITH CHECK (auth.user_id() IS NOT NULL)`,
      },
      {
        name: 'System can update commissions',
        table: 'transaction_commissions',
        sql: `CREATE POLICY "System can update commissions" ON transaction_commissions FOR UPDATE USING (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = transaction_commissions.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active')) WITH CHECK (EXISTS (SELECT 1 FROM user_org_memberships WHERE user_org_memberships.org_id = transaction_commissions.org_id AND user_org_memberships.workos_user_id = auth.user_id() AND user_org_memberships.status = 'active'))`,
      },
      {
        name: 'Admins can view all commissions',
        table: 'transaction_commissions',
        sql: `CREATE POLICY "Admins can view all commissions" ON transaction_commissions FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.workos_user_id = auth.user_id() AND users.role IN ('admin', 'superadmin')))`,
      },
    ];

    let successCount = 0;
    let skipCount = 0;

    for (const policy of policies) {
      try {
        await sql(policy.sql);
        console.log(`✅ Created: "${policy.name}" on ${policy.table}`);
        successCount++;
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⚠️  Already exists: "${policy.name}" on ${policy.table}`);
          skipCount++;
        } else {
          console.error(`❌ Error creating "${policy.name}" on ${policy.table}:`, error.message);
        }
      }
    }

    console.log(`\n📊 Created ${successCount} policies, skipped ${skipCount} existing policies\n`);

    // Verification
    console.log('🔍 Running verification...\n');

    console.log('1️⃣ RLS Status:');
    const rlsStatus = await sql`
      SELECT tablename, rowsecurity as "rls_enabled"
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN (${tables})
      ORDER BY tablename
    `;
    console.table(rlsStatus);

    console.log('\n2️⃣ Policy Counts:');
    const policyCounts = await sql`
      SELECT tablename, COUNT(*) as "policy_count"
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename IN (${tables})
      GROUP BY tablename
      ORDER BY tablename
    `;
    console.table(policyCounts);

    console.log('\n✅ RLS Migration Complete!');
    console.log('\n📝 Expected: 39 total policies');
    console.log('   - annual_plan_eligibility: 4');
    console.log('   - blocked_dates: 5');
    console.log('   - expert_applications: 5');
    console.log('   - roles: 5');
    console.log('   - slot_reservations: 6');
    console.log('   - subscription_events: 3');
    console.log('   - transaction_commissions: 4');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

applyRLSMigration();
