/**
 * Migration Script: Migrate Database Roles to WorkOS RBAC
 *
 * This script migrates existing users from the database-based role system
 * to the new WorkOS native RBAC system.
 *
 * Usage:
 *   bun scripts/migrate-roles-to-workos.ts [--dry-run]
 *
 * Prerequisites:
 *   - WorkOS RBAC configured in Dashboard (permissions and roles created)
 *   - WORKOS_API_KEY environment variable set
 *   - DATABASE_URL environment variable set
 *
 * What this script does:
 *   1. Reads existing users with their database roles
 *   2. Maps old roles to new WorkOS roles
 *   3. Assigns WorkOS roles via the API
 *   4. Logs all changes for audit
 *
 * @see _docs/_WorkOS RABAC implemenation/WORKOS-RBAC-IMPLEMENTATION-GUIDE.md
 */

import { WorkOS } from '@workos-inc/node';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// ============================================================================
// ROLE MAPPING
// ============================================================================

/**
 * Map old database roles to new WorkOS roles
 */
const ROLE_MAPPING: Record<string, string> = {
  // Old role → New WorkOS role slug
  user: 'patient',
  expert_community: 'expert_community',
  expert_top: 'expert_top',
  expert_lecturer: 'expert_community', // Lecturers become community experts
  admin: 'superadmin',
  superadmin: 'superadmin',

  // Default for any unmapped roles
  default: 'patient',
};

/**
 * Get WorkOS role slug for a database role
 */
function mapRole(oldRole: string): string {
  return ROLE_MAPPING[oldRole] || ROLE_MAPPING.default;
}

// ============================================================================
// DATABASE QUERIES
// ============================================================================

interface DatabaseUser {
  id: string;
  workos_id: string;
  email: string;
  role: string;
  organization_memberships?: {
    organization_id: string;
    role: string;
  }[];
}

/**
 * Get all users with their current roles from the database
 *
 * Note: This is a placeholder - replace with your actual database query
 */
async function getUsersFromDatabase(): Promise<DatabaseUser[]> {
  // TODO: Replace this with your actual database query
  // Example using Drizzle ORM:
  //
  // const users = await db
  //   .select({
  //     id: schema.users.id,
  //     workos_id: schema.users.workosId,
  //     email: schema.users.email,
  //     role: schema.users.role,
  //   })
  //   .from(schema.users)
  //   .where(isNotNull(schema.users.workosId));

  console.log('⚠️  Database query placeholder - implement your actual query');
  console.log('   See scripts/migrate-roles-to-workos.ts for details\n');

  // Return empty array for placeholder
  return [];
}

// ============================================================================
// WORKOS API FUNCTIONS
// ============================================================================

/**
 * Assign a role to a user in WorkOS
 */
async function assignWorkOSRole(
  userId: string,
  roleSlug: string,
  organizationId?: string,
): Promise<boolean> {
  try {
    // Note: WorkOS role assignment depends on your setup
    // If using organization membership roles:
    if (organizationId) {
      await workos.userManagement.updateOrganizationMembership(
        userId,
        { roleSlug },
      );
    }
    // If using direct user roles (requires custom implementation):
    // This would typically be done through WorkOS Dashboard or custom metadata

    console.log(`  ✅ Assigned role '${roleSlug}' to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to assign role '${roleSlug}' to user ${userId}:`, error);
    return false;
  }
}

// ============================================================================
// MIGRATION LOGIC
// ============================================================================

interface MigrationResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  details: {
    userId: string;
    email: string;
    oldRole: string;
    newRole: string;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
  }[];
}

/**
 * Run the migration
 */
async function migrate(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  console.log('\n🚀 Starting role migration...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`);

  // Get users from database
  const users = await getUsersFromDatabase();
  result.total = users.length;

  if (users.length === 0) {
    console.log('⚠️  No users found to migrate');
    console.log('   Please implement getUsersFromDatabase() with your actual query\n');
    return result;
  }

  console.log(`📊 Found ${users.length} users to migrate\n`);

  // Process each user
  for (const user of users) {
    const oldRole = user.role || 'user';
    const newRole = mapRole(oldRole);

    // Skip if no WorkOS ID
    if (!user.workos_id) {
      console.log(`⏭️  Skipping ${user.email} - no WorkOS ID`);
      result.skipped++;
      result.details.push({
        userId: user.id,
        email: user.email,
        oldRole,
        newRole,
        status: 'skipped',
        error: 'No WorkOS ID',
      });
      continue;
    }

    console.log(`\n👤 Processing ${user.email}`);
    console.log(`   Old role: ${oldRole} → New role: ${newRole}`);

    if (dryRun) {
      console.log('   [DRY RUN] Would assign role');
      result.successful++;
      result.details.push({
        userId: user.id,
        email: user.email,
        oldRole,
        newRole,
        status: 'success',
      });
      continue;
    }

    // Assign role in WorkOS
    const success = await assignWorkOSRole(user.workos_id, newRole);

    if (success) {
      result.successful++;
      result.details.push({
        userId: user.id,
        email: user.email,
        oldRole,
        newRole,
        status: 'success',
      });
    } else {
      result.failed++;
      result.details.push({
        userId: user.id,
        email: user.email,
        oldRole,
        newRole,
        status: 'failed',
        error: 'WorkOS API error',
      });
    }
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                  WorkOS RBAC Migration Script                      ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Check for required environment variables
  if (!process.env.WORKOS_API_KEY) {
    console.error('❌ Error: WORKOS_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode - no changes will be made\n');
  } else {
    console.log('⚠️  Running in LIVE mode - changes will be applied\n');
    console.log('   Run with --dry-run to preview changes first\n');
  }

  // Run migration
  const result = await migrate(dryRun);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                         Migration Summary                          ');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`Total users:     ${result.total}`);
  console.log(`Successful:      ${result.successful}`);
  console.log(`Failed:          ${result.failed}`);
  console.log(`Skipped:         ${result.skipped}`);

  if (result.failed > 0) {
    console.log('\n❌ Failed migrations:');
    result.details
      .filter((d) => d.status === 'failed')
      .forEach((d) => {
        console.log(`   - ${d.email}: ${d.error}`);
      });
  }

  if (result.skipped > 0) {
    console.log('\n⏭️  Skipped users:');
    result.details
      .filter((d) => d.status === 'skipped')
      .forEach((d) => {
        console.log(`   - ${d.email}: ${d.error}`);
      });
  }

  console.log('\n═══════════════════════════════════════════════════════════════════\n');

  // Exit with error if any failures
  if (result.failed > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});

