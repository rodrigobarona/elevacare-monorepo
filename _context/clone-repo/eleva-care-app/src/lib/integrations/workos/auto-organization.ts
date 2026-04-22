/**
 * Auto-Organization Creation for New Users
 *
 * Airbnb-style approach:
 * - Default: Auto-create patient_personal organization (like Airbnb guests)
 * - Special: "Become an Expert" flow for expert_individual organizations (like "Become a Host")
 *
 * Pattern:
 * - WorkOS creates the user → We create their organization automatically
 * - One organization per user (org-per-user model)
 * - Fast, frictionless for patients (majority of users)
 * - Guided onboarding for experts (minority who opt-in)
 *
 * @see https://workos.com/docs/organizations
 * @see lib/integrations/workos/guest-users.ts (similar pattern)
 */

'use server';

import { db } from '@/drizzle/db';
import {
  OrganizationsTable,
  type OrganizationType,
  UserOrgMembershipsTable,
} from '@/drizzle/schema';
import { workos } from '@/lib/integrations/workos/client';

/**
 * Auto-Organization Creation for New Users
 *
 * Airbnb-style approach:
 * - Default: Auto-create patient_personal organization (like Airbnb guests)
 * - Special: "Become an Expert" flow for expert_individual organizations (like "Become a Host")
 *
 * Pattern:
 * - WorkOS creates the user → We create their organization automatically
 * - One organization per user (org-per-user model)
 * - Fast, frictionless for patients (majority of users)
 * - Guided onboarding for experts (minority who opt-in)
 *
 * @see https://workos.com/docs/organizations
 * @see lib/integrations/workos/guest-users.ts (similar pattern)
 */

/**
 * Auto-create personal organization for new user
 *
 * This runs automatically after WorkOS authentication to ensure
 * every user has an organization (org-per-user model).
 *
 * Default behavior:
 * - Creates `patient_personal` organization for most users
 * - Fast, frictionless experience (like Airbnb guests)
 *
 * Expert flow (with `?expert=true` URL param):
 * - Creates `expert_individual` organization
 * - Redirects to `/setup` for guided onboarding (like "Become a Host")
 *
 * @param params - User organization parameters
 * @param params.workosUserId - WorkOS user ID
 * @param params.email - User email address
 * @param params.firstName - User first name (optional)
 * @param params.lastName - User last name (optional)
 * @param params.orgType - Organization type (defaults to patient_personal)
 * @returns Object containing organizationId and success status
 *
 * @example
 * ```typescript
 * // In auth callback - auto-create patient organization
 * const { organizationId, isNewOrg } = await autoCreateUserOrganization({
 *   workosUserId: 'user_01H...',
 *   email: 'patient@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 *
 * // For expert registration (from ?expert=true URL param)
 * const { organizationId } = await autoCreateUserOrganization({
 *   workosUserId: 'user_01H...',
 *   email: 'expert@example.com',
 *   firstName: 'Dr. Jane',
 *   lastName: 'Smith',
 *   orgType: 'expert_individual',
 * });
 * ```
 */
export async function autoCreateUserOrganization(params: {
  workosUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  orgType?: OrganizationType;
}): Promise<{
  organizationId: string;
  internalOrgId: string;
  isNewOrg: boolean;
  success: boolean;
  error?: string;
}> {
  const {
    workosUserId,
    email,
    firstName,
    lastName,
    orgType = 'patient_personal', // Default: patient
  } = params;

  try {
    console.log(`🏢 Auto-creating organization for user: ${email}`);

    // Check if user already has an organization
    const existingMembership = await db.query.UserOrgMembershipsTable.findFirst({
      where: (fields, { and, eq: eqOp }) =>
        and(eqOp(fields.workosUserId, workosUserId), eqOp(fields.status, 'active')),
      with: {
        organization: true,
      },
    });

    if (existingMembership?.organization) {
      console.log(`✅ User already has organization: ${existingMembership.organization.name}`);
      return {
        organizationId: existingMembership.organization.workosOrgId,
        internalOrgId: existingMembership.organization.id,
        isNewOrg: false,
        success: true,
      };
    }

    // Generate organization name based on type
    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0];
    const orgName =
      orgType === 'expert_individual' ? `${fullName}'s Practice` : `${fullName}'s Account`;

    // Create organization in WorkOS first (source of truth)
    console.log(`🚀 Creating WorkOS organization: ${orgName}`);
    const workosOrg = await workos.organizations.createOrganization({
      name: orgName,
      domainData: [], // No domain verification for personal orgs
    });

    console.log(`✅ WorkOS organization created: ${workosOrg.id}`);

    // Generate unique slug
    const orgSlug = `user-${workosUserId}`;

    // Insert organization into database
    const [org] = await db
      .insert(OrganizationsTable)
      .values({
        workosOrgId: workosOrg.id,
        slug: orgSlug,
        name: orgName,
        type: orgType,
      })
      .returning();

    console.log(`✅ Organization synced to database: ${org.name}`);

    // Create WorkOS membership (user as owner)
    console.log(`👤 Creating WorkOS membership for user: ${email}`);
    const workOSMembership = await workos.userManagement.createOrganizationMembership({
      userId: workosUserId,
      organizationId: workosOrg.id,
      roleSlug: 'owner', // User owns their personal organization
    });

    console.log(`✅ WorkOS membership created: ${workOSMembership.id}`);

    // Insert membership into database
    await db.insert(UserOrgMembershipsTable).values({
      workosUserId: workosUserId,
      orgId: org.id,
      role: 'owner',
      status: 'active',
    });

    console.log(`✅ Membership synced to database`);
    console.log(`🎉 Auto-organization complete for: ${email}`);

    return {
      organizationId: workosOrg.id,
      internalOrgId: org.id,
      isNewOrg: true,
      success: true,
    };
  } catch (error) {
    console.error(`❌ Error auto-creating organization:`, error);
    return {
      organizationId: '',
      internalOrgId: '',
      isNewOrg: false,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if user has an organization
 *
 * Used to determine if we need to redirect to onboarding
 *
 * @param workosUserId - WorkOS user ID
 * @returns Boolean indicating if user has an active organization
 *
 * @example
 * ```typescript
 * const hasOrg = await userHasOrganization('user_01H...');
 * if (!hasOrg) {
 *   redirect('/onboarding');
 * }
 * ```
 */
export async function userHasOrganization(workosUserId: string): Promise<boolean> {
  try {
    const membership = await db.query.UserOrgMembershipsTable.findFirst({
      where: (fields, { and, eq: eqOp }) =>
        and(eqOp(fields.workosUserId, workosUserId), eqOp(fields.status, 'active')),
    });

    return !!membership;
  } catch (error) {
    console.error(`❌ Error checking user organization:`, error);
    return false;
  }
}

/**
 * Get user's organization type
 *
 * Used to determine routing (dashboard vs setup)
 *
 * @param workosUserId - WorkOS user ID
 * @returns Organization type or null if no organization
 *
 * @example
 * ```typescript
 * const orgType = await getUserOrganizationType('user_01H...');
 * if (orgType === 'expert_individual') {
 *   redirect('/setup');
 * }
 * ```
 */
export async function getUserOrganizationType(
  workosUserId: string,
): Promise<OrganizationType | null> {
  try {
    const membership = await db.query.UserOrgMembershipsTable.findFirst({
      where: (fields, { and, eq: eqOp }) =>
        and(eqOp(fields.workosUserId, workosUserId), eqOp(fields.status, 'active')),
      with: {
        organization: true,
      },
    });

    return membership?.organization?.type || null;
  } catch (error) {
    console.error(`❌ Error getting user organization type:`, error);
    return null;
  }
}
