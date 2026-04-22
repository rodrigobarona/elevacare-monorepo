/**
 * Cleanup Broken Organizations Script
 *
 * This script fixes users who got stuck during organization creation due to
 * the "invalid role" error in WorkOS. It:
 *
 * 1. Finds users without proper organization memberships
 * 2. Identifies orphaned organizations in the database
 * 3. Connects users to their organizations
 * 4. Creates missing organizations if needed
 *
 * Run with: bun scripts/utilities/cleanup-broken-organizations.ts
 */
// Load environment variables first
import { db } from '@/drizzle/db';
import { OrganizationsTable, UserOrgMembershipsTable, UsersTable } from '@/drizzle/schema';
import { workos } from '@/lib/integrations/workos/client';
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';

interface BrokenUser {
  workosUserId: string;
  email: string;
  dbOrganization?: {
    id: string;
    workosOrgId: string;
    name: string;
    slug: string;
  };
  workosOrganizations: Array<{
    id: string;
    name: string;
  }>;
}

async function findBrokenUsers(): Promise<BrokenUser[]> {
  console.log('🔍 Finding users without proper organization memberships...\n');

  // Get all users from database
  const users = await db.select().from(UsersTable);

  const brokenUsers: BrokenUser[] = [];

  for (const user of users) {
    // Check if user has an active membership
    const membership = await db.query.UserOrgMembershipsTable.findFirst({
      where: and(
        eq(UserOrgMembershipsTable.workosUserId, user.workosUserId),
        eq(UserOrgMembershipsTable.status, 'active'),
      ),
      with: {
        organization: true,
      },
    });

    if (!membership) {
      // User has no membership - this is broken!
      console.log(`❌ Found broken user: ${user.email} (${user.workosUserId})`);

      // Check if there's an orphaned organization in the database
      const orgSlug = `user-${user.workosUserId}`;
      const dbOrg = await db.query.OrganizationsTable.findFirst({
        where: eq(OrganizationsTable.slug, orgSlug),
      });

      if (dbOrg) {
        console.log(`   📦 Found orphaned DB org: ${dbOrg.name} (${dbOrg.id})`);
      }

      // Check WorkOS for this user's organizations
      try {
        const workosOrgs = await workos.userManagement.listOrganizationMemberships({
          userId: user.workosUserId,
        });

        const userOrgs = workosOrgs.data.map((membership) => ({
          id: membership.organizationId,
          name: 'Unknown', // Note: OrganizationMembership doesn't include organization name
        }));

        if (userOrgs.length > 0) {
          console.log(`   🌐 Found ${userOrgs.length} WorkOS org(s):`, userOrgs);
        }

        brokenUsers.push({
          workosUserId: user.workosUserId,
          email: user.email,
          dbOrganization: dbOrg
            ? {
                id: dbOrg.id,
                workosOrgId: dbOrg.workosOrgId,
                name: dbOrg.name,
                slug: dbOrg.slug,
              }
            : undefined,
          workosOrganizations: userOrgs,
        });
      } catch (error) {
        console.error(`   ⚠️ Error fetching WorkOS orgs:`, error);
      }

      console.log('');
    }
  }

  return brokenUsers;
}

async function fixBrokenUser(brokenUser: BrokenUser, dryRun: boolean = true): Promise<void> {
  console.log(`\n🔧 Fixing user: ${brokenUser.email}`);

  // Case 1: User has DB org but no membership
  if (brokenUser.dbOrganization && brokenUser.workosOrganizations.length > 0) {
    console.log(`   Case 1: User has both DB org and WorkOS org(s)`);

    // Find matching WorkOS org
    const matchingWorkOSOrg = brokenUser.workosOrganizations.find(
      (wOrg) => wOrg.id === brokenUser.dbOrganization!.workosOrgId,
    );

    if (matchingWorkOSOrg) {
      console.log(`   ✅ Found matching WorkOS org: ${matchingWorkOSOrg.name}`);
      console.log(`   📝 Creating membership link in database...`);

      if (!dryRun) {
        await db.insert(UserOrgMembershipsTable).values({
          workosUserId: brokenUser.workosUserId,
          orgId: brokenUser.dbOrganization.id,
          role: 'owner',
          status: 'active',
        });
        console.log(`   ✅ Membership created successfully!`);
      } else {
        console.log(`   🔵 [DRY RUN] Would create membership`);
      }
    } else {
      console.log(`   ⚠️ DB org doesn't match any WorkOS org`);
      console.log(`   DB org WorkOS ID: ${brokenUser.dbOrganization.workosOrgId}`);
      console.log(
        `   WorkOS org IDs:`,
        brokenUser.workosOrganizations.map((o) => o.id),
      );

      // Use the first WorkOS org and update DB org
      const workosOrg = brokenUser.workosOrganizations[0];
      console.log(`   📝 Updating DB org to match WorkOS org: ${workosOrg.name}`);

      if (!dryRun) {
        await db
          .update(OrganizationsTable)
          .set({
            workosOrgId: workosOrg.id,
            name: workosOrg.name,
          })
          .where(eq(OrganizationsTable.id, brokenUser.dbOrganization.id));

        await db.insert(UserOrgMembershipsTable).values({
          workosUserId: brokenUser.workosUserId,
          orgId: brokenUser.dbOrganization.id,
          role: 'owner',
          status: 'active',
        });
        console.log(`   ✅ Fixed successfully!`);
      } else {
        console.log(`   🔵 [DRY RUN] Would update org and create membership`);
      }
    }
  }
  // Case 2: User has WorkOS org but no DB org
  else if (!brokenUser.dbOrganization && brokenUser.workosOrganizations.length > 0) {
    console.log(`   Case 2: User has WorkOS org but no DB org`);

    const workosOrg = brokenUser.workosOrganizations[0];
    console.log(`   📝 Creating DB org for: ${workosOrg.name}`);

    if (!dryRun) {
      const [dbOrg] = await db
        .insert(OrganizationsTable)
        .values({
          workosOrgId: workosOrg.id,
          slug: `user-${brokenUser.workosUserId}`,
          name: workosOrg.name,
          type: 'patient_personal', // Default to patient
        })
        .returning();

      await db.insert(UserOrgMembershipsTable).values({
        workosUserId: brokenUser.workosUserId,
        orgId: dbOrg.id,
        role: 'owner',
        status: 'active',
      });
      console.log(`   ✅ Created DB org and membership successfully!`);
    } else {
      console.log(`   🔵 [DRY RUN] Would create DB org and membership`);
    }
  }
  // Case 3: User has DB org but no WorkOS org (orphaned)
  else if (brokenUser.dbOrganization && brokenUser.workosOrganizations.length === 0) {
    console.log(`   Case 3: User has orphaned DB org with no WorkOS org`);
    console.log(`   ⚠️ This usually means the WorkOS membership creation failed`);
    console.log(`   DB org: ${brokenUser.dbOrganization.name}`);
    console.log(`   DB org WorkOS ID: ${brokenUser.dbOrganization.workosOrgId}`);

    // Try to fetch the WorkOS org directly
    try {
      const workosOrg = await workos.organizations.getOrganization(
        brokenUser.dbOrganization.workosOrgId,
      );

      console.log(`   ✅ Found WorkOS org: ${workosOrg.name}`);
      console.log(`   📝 WorkOS org exists but membership is missing!`);
      console.log(`   📝 Creating membership link...`);

      if (!dryRun) {
        // Create WorkOS membership first
        try {
          await workos.userManagement.createOrganizationMembership({
            userId: brokenUser.workosUserId,
            organizationId: brokenUser.dbOrganization.workosOrgId,
            roleSlug: 'org-owner', // Correct slug for Owner role
          });
          console.log(`   ✅ WorkOS membership created with "org-owner" role`);
        } catch (membershipError: any) {
          console.error(`   ⚠️ Error creating WorkOS membership:`, membershipError.message);
        }

        // Create DB membership
        await db.insert(UserOrgMembershipsTable).values({
          workosUserId: brokenUser.workosUserId,
          orgId: brokenUser.dbOrganization.id,
          role: 'org-owner', // Match WorkOS role slug
          status: 'active',
        });
        console.log(`   ✅ DB membership created`);
      } else {
        console.log(`   🔵 [DRY RUN] Would create WorkOS and DB membership`);
      }
    } catch (error: any) {
      console.log(`   ❌ WorkOS org not found: ${error.message}`);
      console.log(`   📝 Recommend: Delete orphaned DB org`);

      if (!dryRun) {
        console.log(`   🗑️  Deleting orphaned DB org...`);
        await db
          .delete(OrganizationsTable)
          .where(eq(OrganizationsTable.id, brokenUser.dbOrganization!.id));
        console.log(`   ✅ Orphaned org deleted`);
      } else {
        console.log(`   🔵 [DRY RUN] Would delete orphaned DB org`);
      }
    }
  }
  // Case 4: User has no org at all (needs auto-create to run)
  else {
    console.log(`   Case 4: User has no organizations at all`);
    console.log(`   📝 User needs to log in again to trigger auto-create`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  console.log('🚀 Cleanup Broken Organizations Script\n');
  console.log(`Mode: ${dryRun ? '🔵 DRY RUN (--apply to execute)' : '🟢 APPLY CHANGES'}\n`);
  console.log('=' + '='.repeat(70) + '\n');

  // Find broken users
  const brokenUsers = await findBrokenUsers();

  if (brokenUsers.length === 0) {
    console.log('✅ No broken users found! Everything looks good.\n');
    return;
  }

  console.log(`\n${'='.repeat(71)}`);
  console.log(`Found ${brokenUsers.length} broken user(s)\n`);

  // Fix each broken user
  for (const brokenUser of brokenUsers) {
    await fixBrokenUser(brokenUser, dryRun);
  }

  console.log(`\n${'='.repeat(71)}`);

  if (dryRun) {
    console.log('\n🔵 This was a dry run. No changes were made.');
    console.log('Run with --apply to execute the fixes:\n');
    console.log('  bun scripts/utilities/cleanup-broken-organizations.ts --apply\n');
  } else {
    console.log('\n✅ Cleanup complete!\n');
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
