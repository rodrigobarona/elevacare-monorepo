/**
 * Apply RLS Migration for Missing Tables
 *
 * This script applies the comprehensive RLS migration (003_enable_rls_missing_tables.sql)
 * to the development database.
 */
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

import { db } from '../drizzle/db';

async function applyRLSMigration() {
  console.log('🔒 Applying RLS Migration for Missing Tables...\n');

  try {
    // Read the SQL file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'drizzle/migrations-manual/003_enable_rls_missing_tables.sql'),
      'utf-8',
    );

    // Split by semicolons and filter out comments and empty statements
    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => {
        // Remove comments and empty statements
        return (
          stmt.length > 0 &&
          !stmt.startsWith('--') &&
          !stmt.startsWith('/*') &&
          stmt !== '/*' &&
          !stmt.startsWith('/**')
        );
      });

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip verification queries (they're just for manual checks)
      if (statement.includes('SELECT') && !statement.includes('POLICY')) {
        console.log(`⏭️  Skipping verification query ${i + 1}/${statements.length}`);
        continue;
      }

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
        await db.execute(sql.raw(statement));
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Some statements might fail if already applied (e.g., ENABLE RLS if already enabled)
        if (error.message.includes('already exists') || error.message.includes('already enabled')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already applied)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ RLS Migration applied successfully!');
    console.log('\n🔍 Verification queries:\n');

    // Run verification queries
    console.log('Checking RLS status on tables...');
    const rlsStatus = await db.execute(sql`
      SELECT 
        tablename,
        rowsecurity as "RLS Enabled"
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
    `);

    console.table(rlsStatus.rows);

    console.log('\nChecking policies per table...');
    const policyCounts = await db.execute(sql`
      SELECT 
        tablename,
        COUNT(*) as "Number of Policies"
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
    `);

    console.table(policyCounts.rows);

    console.log('\n🎉 All done! RLS is now enabled on all tables.');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

applyRLSMigration();
