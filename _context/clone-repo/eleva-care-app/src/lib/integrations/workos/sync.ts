/**
 * WorkOS Synchronization Utilities
 *
 * Single Source of Truth Pattern:
 * - WorkOS API is the authoritative source for user and organization data
 * - Database acts as a cache for performance and relationships
 * - All sync operations are idempotent and handle partial failures gracefully
 *
 * Key Principles:
 * 1. Always fetch from WorkOS API when syncing
 * 2. Use upserts to handle both new and existing records
 * 3. Log all operations for audit trail
 * 4. Never block authentication on sync failures
 * 5. Retry transient errors with exponential backoff
 *
 * @see https://workos.com/docs/user-management
 * @see https://workos.com/docs/organizations
 */
import { db } from '@/drizzle/db';
import {
  OrganizationsTable,
  ProfilesTable,
  UserOrgMembershipsTable,
  UsersTable,
} from '@/drizzle/schema';
import type { OrganizationMembership, User as WorkOSUser } from '@workos-inc/node';
import { and, eq } from 'drizzle-orm';

import { workos } from './client';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  error?: string;
  userId?: string;
  organizationId?: string;
}

export interface WorkOSUserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
  profilePictureUrl?: string | null;
}

export interface WorkOSOrganizationData {
  id: string;
  name: string;
  slug?: string;
  domains?: { domain: string; state: string }[];
}

// ============================================================================
// User Synchronization
// ============================================================================

/**
 * Fetch user data from WorkOS API (source of truth)
 *
 * @param workosUserId - WorkOS user ID
 * @returns User data from WorkOS or null if not found
 *
 * @example
 * ```typescript
 * const workosUser = await getWorkOSUserById('user_01H...');
 * if (workosUser) {
 *   console.log(`User: ${workosUser.firstName} ${workosUser.lastName}`);
 * }
 * ```
 */
export async function getWorkOSUserById(workosUserId: string): Promise<WorkOSUser | null> {
  try {
    console.log(`📡 Fetching user from WorkOS: ${workosUserId}`);
    const user = await workos.userManagement.getUser(workosUserId);
    console.log(`✅ Fetched user: ${user.email}`);
    return user;
  } catch (error) {
    console.error(`❌ Error fetching user from WorkOS:`, error);
    if (error instanceof Error && error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
}

/**
 * Sync WorkOS user to database (upsert)
 *
 * This is the core sync function that maintains user data in the database.
 * WorkOS API is treated as the source of truth.
 *
 * @param userData - User data from WorkOS
 * @returns Sync result with userId
 *
 * @example
 * ```typescript
 * // In callback handler
 * const result = await syncWorkOSUserToDatabase({
 *   id: user.id,
 *   email: user.email,
 *   firstName: user.firstName,
 *   lastName: user.lastName,
 *   emailVerified: user.emailVerified,
 *   profilePictureUrl: user.profilePictureUrl,
 * });
 *
 * if (result.success) {
 *   console.log('User synced successfully');
 * }
 * ```
 */
export async function syncWorkOSUserToDatabase(userData: WorkOSUserData): Promise<SyncResult> {
  try {
    console.log(`🔄 Syncing user to database: ${userData.email}`);

    // Check if user exists
    const existingUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.workosUserId, userData.id),
    });

    if (existingUser) {
      // Update existing user
      console.log(`📝 Updating existing user: ${userData.email}`);
      await db
        .update(UsersTable)
        .set({
          email: userData.email,
          imageUrl: userData.profilePictureUrl || existingUser.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(UsersTable.workosUserId, userData.id));

      console.log(`✅ User updated: ${userData.email}`);
    } else {
      // Create new user
      console.log(`➕ Creating new user: ${userData.email}`);
      await db.insert(UsersTable).values({
        workosUserId: userData.id,
        email: userData.email,
        imageUrl: userData.profilePictureUrl || null,
        role: 'user', // Default role
      });

      console.log(`✅ User created: ${userData.email}`);
    }

    // ⚠️ IMPORTANT: Do NOT create ProfilesTable or ExpertSetupTable here
    // These tables are ONLY for experts and should be created when:
    // - User becomes an expert (via expert application approval)
    // - Or registers via /become-expert flow with expert_individual org type
    //
    // Creating profiles for all users causes:
    // 1. Database bloat (profiles for non-experts)
    // 2. Incorrect UI states (setup banners for patients)
    // 3. RLS issues (profiles without proper org associations)

    return {
      success: true,
      userId: userData.id,
    };
  } catch (error) {
    console.error(`❌ Error syncing user to database:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync user profile data (firstName/lastName) to ProfilesTable
 *
 * This ensures user names are available immediately after authentication.
 * Only syncs WorkOS-owned fields; preserves user-edited fields like bio.
 *
 * @param userData - User data from WorkOS
 *
 * @example
 * ```typescript
 * await syncUserProfileData({
 *   id: 'user_01H...',
 *   email: 'john@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 * ```
 */
export async function syncUserProfileData(userData: WorkOSUserData): Promise<void> {
  try {
    console.log(`🔄 Syncing profile data for: ${userData.email}`);

    // Check if profile exists
    const existingProfile = await db.query.ProfilesTable.findFirst({
      where: eq(ProfilesTable.workosUserId, userData.id),
    });

    if (existingProfile) {
      // Update only WorkOS-owned fields (don't overwrite user-edited bio, etc.)
      console.log(`📝 Updating profile for: ${userData.email}`);
      await db
        .update(ProfilesTable)
        .set({
          firstName: userData.firstName || existingProfile.firstName,
          lastName: userData.lastName || existingProfile.lastName,
          updatedAt: new Date(),
        })
        .where(eq(ProfilesTable.workosUserId, userData.id));
    } else {
      // Create new profile with WorkOS data
      console.log(`➕ Creating profile for: ${userData.email}`);
      await db.insert(ProfilesTable).values({
        workosUserId: userData.id,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        published: false, // Not published until onboarding complete
      });
    }

    console.log(`✅ Profile synced for: ${userData.email}`);
  } catch (error) {
    console.error(`❌ Error syncing profile data:`, error);
    // Don't throw - profile sync shouldn't block authentication
  }
}

/**
 * Delete user from database
 *
 * Handles user deletion events from WorkOS webhooks.
 * Cascading deletes are handled by database foreign key constraints.
 *
 * @param workosUserId - WorkOS user ID
 *
 * @example
 * ```typescript
 * // In webhook handler
 * if (event.event === 'user.deleted') {
 *   await deleteUserFromDatabase(event.data.id);
 * }
 * ```
 */
export async function deleteUserFromDatabase(workosUserId: string): Promise<SyncResult> {
  try {
    console.log(`🗑️ Deleting user from database: ${workosUserId}`);

    const deletedUser = await db
      .delete(UsersTable)
      .where(eq(UsersTable.workosUserId, workosUserId))
      .returning();

    if (deletedUser.length === 0) {
      console.log(`⚠️ User not found in database: ${workosUserId}`);
      return {
        success: true, // Not an error - already deleted
        userId: workosUserId,
      };
    }

    console.log(`✅ User deleted: ${workosUserId}`);
    return {
      success: true,
      userId: workosUserId,
    };
  } catch (error) {
    console.error(`❌ Error deleting user from database:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Organization Synchronization
// ============================================================================

/**
 * Sync WorkOS organization to database (upsert)
 *
 * @param orgData - Organization data from WorkOS
 * @param orgType - Application-specific organization type
 * @returns Sync result with organizationId
 *
 * @example
 * ```typescript
 * const result = await syncWorkOSOrganizationToDatabase(
 *   {
 *     id: 'org_01H...',
 *     name: "Dr. Maria's Practice",
 *     slug: 'dr-maria-practice',
 *   },
 *   'expert_individual'
 * );
 * ```
 */
export async function syncWorkOSOrganizationToDatabase(
  orgData: WorkOSOrganizationData,
  orgType:
    | 'patient_personal'
    | 'expert_individual'
    | 'clinic'
    | 'educational_institution' = 'patient_personal',
): Promise<SyncResult> {
  try {
    console.log(`🔄 Syncing organization to database: ${orgData.name}`);

    // Check if organization exists
    const existingOrg = await db.query.OrganizationsTable.findFirst({
      where: eq(OrganizationsTable.workosOrgId, orgData.id),
    });

    // Generate slug if not provided
    const slug = orgData.slug || `org-${orgData.id}`;

    if (existingOrg) {
      // Update existing organization
      console.log(`📝 Updating existing organization: ${orgData.name}`);
      await db
        .update(OrganizationsTable)
        .set({
          name: orgData.name,
          slug,
          type: orgType,
          updatedAt: new Date(),
        })
        .where(eq(OrganizationsTable.workosOrgId, orgData.id));
    } else {
      // Create new organization
      console.log(`➕ Creating new organization: ${orgData.name}`);
      await db.insert(OrganizationsTable).values({
        workosOrgId: orgData.id,
        name: orgData.name,
        slug,
        type: orgType,
      });
    }

    console.log(`✅ Organization synced: ${orgData.name}`);
    return {
      success: true,
      organizationId: orgData.id,
    };
  } catch (error) {
    console.error(`❌ Error syncing organization to database:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync user organization membership
 *
 * Maintains the relationship between users and organizations.
 *
 * @param membership - Membership data from WorkOS
 * @returns Sync result
 *
 * @example
 * ```typescript
 * await syncUserOrgMembership({
 *   userId: 'user_01H...',
 *   organizationId: 'org_01H...',
 *   role: { slug: 'member' },
 *   status: 'active',
 * });
 * ```
 */
export async function syncUserOrgMembership(
  membership: OrganizationMembership,
): Promise<SyncResult> {
  try {
    console.log(
      `🔄 Syncing membership: user ${membership.userId} → org ${membership.organizationId}`,
    );

    // Get internal org ID
    const org = await db.query.OrganizationsTable.findFirst({
      where: eq(OrganizationsTable.workosOrgId, membership.organizationId),
    });

    if (!org) {
      console.error(`❌ Organization not found: ${membership.organizationId}`);
      return {
        success: false,
        error: 'Organization not found in database',
      };
    }

    // Check if membership exists
    const existingMembership = await db.query.UserOrgMembershipsTable.findFirst({
      where: (fields, { and, eq: eqOp }) =>
        and(eqOp(fields.workosUserId, membership.userId), eqOp(fields.orgId, org.id)),
    });

    const roleSlug = membership.role?.slug || 'member';
    const status = membership.status as 'active' | 'inactive' | 'pending';

    if (existingMembership) {
      // Update existing membership
      console.log(`📝 Updating membership for user: ${membership.userId}`);
      await db
        .update(UserOrgMembershipsTable)
        .set({
          role: roleSlug,
          status,
          updatedAt: new Date(),
        })
        .where(eq(UserOrgMembershipsTable.id, existingMembership.id));
    } else {
      // Create new membership
      console.log(`➕ Creating membership for user: ${membership.userId}`);
      await db.insert(UserOrgMembershipsTable).values({
        workosUserId: membership.userId,
        orgId: org.id,
        role: roleSlug,
        status,
      });
    }

    console.log(`✅ Membership synced for user: ${membership.userId}`);
    return {
      success: true,
      userId: membership.userId,
      organizationId: membership.organizationId,
    };
  } catch (error) {
    console.error(`❌ Error syncing membership:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync all memberships for an organization
 *
 * Fetches and syncs all members from WorkOS API.
 * Useful for webhook handlers and batch sync operations.
 *
 * @param organizationId - WorkOS organization ID
 *
 * @example
 * ```typescript
 * // Sync all members when org is updated
 * await syncOrganizationMemberships('org_01H...');
 * ```
 */
export async function syncOrganizationMemberships(organizationId: string): Promise<void> {
  try {
    console.log(`🔄 Syncing all memberships for org: ${organizationId}`);

    // Fetch memberships from WorkOS
    const { data: memberships } = await workos.userManagement.listOrganizationMemberships({
      organizationId,
    });

    console.log(`📋 Found ${memberships.length} memberships to sync`);

    // Sync each membership
    for (const membership of memberships) {
      await syncUserOrgMembership(membership);
    }

    console.log(`✅ All memberships synced for org: ${organizationId}`);
  } catch (error) {
    console.error(`❌ Error syncing organization memberships:`, error);
    // Don't throw - log and continue
  }
}

/**
 * Update user's membership role
 *
 * @param workosUserId - WorkOS user ID
 * @param organizationId - WorkOS organization ID
 * @param role - New role slug
 *
 * @example
 * ```typescript
 * await updateMembershipRole('user_01H...', 'org_01H...', 'admin');
 * ```
 */
export async function updateMembershipRole(
  workosUserId: string,
  organizationId: string,
  role: string,
): Promise<SyncResult> {
  try {
    console.log(`🔄 Updating role for user ${workosUserId} in org ${organizationId} to ${role}`);

    // Get internal org ID
    const org = await db.query.OrganizationsTable.findFirst({
      where: eq(OrganizationsTable.workosOrgId, organizationId),
    });

    if (!org) {
      return {
        success: false,
        error: 'Organization not found',
      };
    }

    // Update membership
    await db
      .update(UserOrgMembershipsTable)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(UserOrgMembershipsTable.workosUserId, workosUserId),
          eq(UserOrgMembershipsTable.orgId, org.id),
        ),
      );

    console.log(`✅ Role updated successfully`);
    return {
      success: true,
      userId: workosUserId,
      organizationId,
    };
  } catch (error) {
    console.error(`❌ Error updating membership role:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Full sync for a user (user + profile + memberships)
 *
 * Fetches fresh data from WorkOS and syncs everything.
 * Use this for webhook handlers or manual sync operations.
 *
 * @param workosUserId - WorkOS user ID
 * @returns Sync result
 *
 * @example
 * ```typescript
 * // In webhook handler for user.updated
 * const result = await fullUserSync('user_01H...');
 * ```
 */
export async function fullUserSync(workosUserId: string): Promise<SyncResult> {
  try {
    console.log(`🔄 Starting full sync for user: ${workosUserId}`);

    // Fetch user from WorkOS (source of truth)
    const workosUser = await getWorkOSUserById(workosUserId);

    if (!workosUser) {
      return {
        success: false,
        error: 'User not found in WorkOS',
      };
    }

    // Sync user to database
    const userResult = await syncWorkOSUserToDatabase({
      id: workosUser.id,
      email: workosUser.email,
      firstName: workosUser.firstName,
      lastName: workosUser.lastName,
      emailVerified: workosUser.emailVerified,
      profilePictureUrl: workosUser.profilePictureUrl,
    });

    if (!userResult.success) {
      return userResult;
    }

    // Sync memberships
    const { data: memberships } = await workos.userManagement.listOrganizationMemberships({
      userId: workosUserId,
    });

    for (const membership of memberships) {
      await syncUserOrgMembership(membership);
    }

    console.log(`✅ Full sync completed for user: ${workosUserId}`);
    return {
      success: true,
      userId: workosUserId,
    };
  } catch (error) {
    console.error(`❌ Error in full user sync:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
