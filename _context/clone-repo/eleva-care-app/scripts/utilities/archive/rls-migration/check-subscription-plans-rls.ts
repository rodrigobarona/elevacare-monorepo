/**
 * Check subscription_plans RLS Status
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function checkSubscriptionPlans() {
  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;
  const sql = neon(databaseUrl);

  console.log('🔍 Checking subscription_plans RLS Status...\n');

  // Check RLS status
  const rlsStatus = await sql`
    SELECT 
      tablename,
      rowsecurity as "rls_enabled"
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'subscription_plans'
  `;
  console.log('RLS Status:');
  console.table(rlsStatus);

  // Check existing policies
  const policies = await sql`
    SELECT 
      policyname,
      cmd as "operation"
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'subscription_plans'
    ORDER BY policyname
  `;

  console.log('\nExisting Policies:');
  if (policies.length > 0) {
    console.table(policies);
  } else {
    console.log('❌ No policies found!');
  }

  process.exit(0);
}

checkSubscriptionPlans();
