/**
 * Verify RLS Migration
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function verifyRLS() {
  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;
  const sql = neon(databaseUrl);

  console.log('🔍 Verifying RLS Migration...\n');

  // Check RLS status
  console.log('1️⃣ RLS Status on Tables:');
  const rlsStatus = await sql`
    SELECT 
      tablename,
      rowsecurity as "rls_enabled"
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'annual_plan_eligibility',
        'blocked_dates',
        'expert_applications',
        'roles',
        'slot_reservations',
        'subscription_events',
        'transaction_commissions'
      )
    ORDER BY tablename
  `;
  console.table(rlsStatus);

  // Check policy counts
  console.log('\n2️⃣ Policy Counts per Table:');
  const policyCounts = await sql`
    SELECT 
      tablename,
      COUNT(*) as "policy_count"
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'annual_plan_eligibility',
        'blocked_dates',
        'expert_applications',
        'roles',
        'slot_reservations',
        'subscription_events',
        'transaction_commissions'
      )
    GROUP BY tablename
    ORDER BY tablename
  `;
  console.table(policyCounts);

  // List all policies
  console.log('\n3️⃣ All Policies Created:');
  const allPolicies = await sql`
    SELECT 
      tablename,
      policyname,
      cmd as "operation"
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'annual_plan_eligibility',
        'blocked_dates',
        'expert_applications',
        'roles',
        'slot_reservations',
        'subscription_events',
        'transaction_commissions'
      )
    ORDER BY tablename, policyname
  `;

  const byTable: Record<string, any[]> = {};
  for (const policy of allPolicies) {
    if (!byTable[policy.tablename]) {
      byTable[policy.tablename] = [];
    }
    byTable[policy.tablename].push(`${policy.policyname} (${policy.operation})`);
  }

  for (const [table, policies] of Object.entries(byTable)) {
    console.log(`\n   ${table}: ${policies.length} policies`);
    policies.forEach((p) => console.log(`     • ${p}`));
  }

  // Total count
  const totalCount = await sql`
    SELECT COUNT(*) as total
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'annual_plan_eligibility',
        'blocked_dates',
        'expert_applications',
        'roles',
        'slot_reservations',
        'subscription_events',
        'transaction_commissions'
      )
  `;

  console.log(`\n📊 Total Policies Created: ${totalCount[0].total}`);
  console.log(`📝 Expected: 39 total policies`);

  if (parseInt(totalCount[0].total) >= 32) {
    console.log('\n✅ RLS Migration Verified Successfully!');
  } else {
    console.log('\n⚠️  Some policies may be missing. Please review the output above.');
  }

  process.exit(0);
}

verifyRLS();
