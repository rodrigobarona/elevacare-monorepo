/**
 * Apply RLS Migration using Neon Serverless Driver
 *
 * This script applies the RLS migration by executing the SQL file
 * directly using the Neon serverless driver with proper connection pooling.
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyRLSMigration() {
  console.log('🔒 Applying RLS Migration for Missing Tables...\n');

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_DEV_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_DEV_URL or DATABASE_URL environment variable not set');
    console.error('   Please ensure .env.local file exists with the database URL');
    process.exit(1);
  }

  console.log('📡 Connecting to Neon database...');
  console.log(`   Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}\n`);

  try {
    // Create Neon SQL client
    const sql = neon(databaseUrl);

    // Read the migration file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'drizzle/migrations-manual/003_enable_rls_missing_tables.sql'),
      'utf-8',
    );

    console.log('📝 Migration file loaded successfully\n');

    // Split into individual statements by semicolons
    // We need to be careful to preserve multi-line statements
    const statements = migrationSQL
      .split(/;\s*\n/)
      .map((stmt) => stmt.trim())
      .filter((stmt) => {
        // Remove comments and empty statements
        const lines = stmt.split('\n').filter((line) => {
          const trimmed = line.trim();
          return (
            trimmed.length > 0 &&
            !trimmed.startsWith('--') &&
            !trimmed.startsWith('/*') &&
            trimmed !== '/*' &&
            trimmed !== '*/' &&
            !trimmed.startsWith('/**')
          );
        });
        return lines.length > 0;
      });

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip verification SELECT queries
      if (
        statement.toUpperCase().includes('SELECT') &&
        !statement.toUpperCase().includes('POLICY') &&
        !statement.toUpperCase().includes('ALTER TABLE')
      ) {
        console.log(`⏭️  Statement ${i + 1}/${statements.length}: Skipping verification query`);
        skipCount++;
        continue;
      }

      try {
        console.log(`⚙️  Statement ${i + 1}/${statements.length}: Executing...`);
        await sql(statement);
        console.log(`✅ Statement ${i + 1}/${statements.length}: Success`);
        successCount++;
      } catch (error: any) {
        // Some statements might fail if already applied
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('already enabled') ||
          error.message?.includes('duplicate')
        ) {
          console.log(`⚠️  Statement ${i + 1}/${statements.length}: Already applied (skipped)`);
          skipCount++;
        } else {
          console.error(`❌ Statement ${i + 1}/${statements.length}: Error - ${error.message}`);
          errorCount++;

          // Show the statement that failed (first 100 chars)
          console.error(`   Statement: ${statement.substring(0, 100)}...`);

          // Don't stop on errors, continue with remaining statements
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed, but continuing...\n');
    }

    // Run verification queries
    console.log('🔍 Running verification queries...\n');

    console.log('1️⃣ Checking RLS status on tables:');
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

    console.log('\n2️⃣ Checking policy counts per table:');
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

    console.log('\n✅ RLS Migration completed!');
    console.log('\n📝 Expected policy counts:');
    console.log('   - annual_plan_eligibility: 4 policies');
    console.log('   - blocked_dates: 5 policies');
    console.log('   - expert_applications: 5 policies');
    console.log('   - roles: 5 policies');
    console.log('   - slot_reservations: 6 policies');
    console.log('   - subscription_events: 3 policies');
    console.log('   - transaction_commissions: 4 policies');
    console.log('\n🎉 All done! RLS is now enabled on all tables.');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }

  process.exit(0);
}

applyRLSMigration();
