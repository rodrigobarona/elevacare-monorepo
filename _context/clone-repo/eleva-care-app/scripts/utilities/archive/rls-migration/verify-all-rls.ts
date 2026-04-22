/**
 * Complete RLS Verification - All Tables
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function verifyAllRLS() {
  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;
  const sql = neon(databaseUrl);

  console.log('🔍 Complete RLS Verification - All Tables\n');
  console.log('='.repeat(60) + '\n');

  // Check all tables in public schema
  const allTables = await sql`
    SELECT 
      tablename,
      rowsecurity as "rls_enabled"
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  console.log('📊 All Tables RLS Status:\n');
  console.table(allTables);

  // Count tables with/without RLS
  const withRLS = allTables.filter((t) => t.rls_enabled === true);
  const withoutRLS = allTables.filter((t) => t.rls_enabled === false);

  console.log('\n📈 Summary:');
  console.log(`   ✅ Tables with RLS: ${withRLS.length}`);
  console.log(`   ❌ Tables without RLS: ${withoutRLS.length}`);

  if (withoutRLS.length > 0) {
    console.log('\n⚠️  Tables Missing RLS:');
    withoutRLS.forEach((t) => console.log(`   - ${t.tablename}`));
  }

  // Get total policy count
  const policyCount = await sql`
    SELECT COUNT(*) as total
    FROM pg_policies 
    WHERE schemaname = 'public'
  `;

  console.log(`\n📝 Total Security Policies: ${policyCount[0].total}`);

  // Get policies per table
  const policiesPerTable = await sql`
    SELECT 
      tablename,
      COUNT(*) as "policy_count"
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
    ORDER BY tablename
  `;

  console.log('\n📋 Policies per Table:\n');
  console.table(policiesPerTable);

  // Final status
  console.log('\n' + '='.repeat(60));
  if (withoutRLS.length === 0) {
    console.log('✅ ALL TABLES HAVE RLS ENABLED!');
    console.log(`🔒 Total: ${allTables.length} tables, ${policyCount[0].total} policies`);
  } else {
    console.log(`⚠️  ${withoutRLS.length} tables still need RLS`);
  }
  console.log('='.repeat(60));

  process.exit(0);
}

verifyAllRLS();
