'use server';

import { db } from '@/drizzle/db';
import { OrganizationsTable, UserOrgMembershipsTable, UsersTable } from '@/drizzle/schema';
import { workos } from '@/lib/integrations/workos/client';
import { eq } from 'drizzle-orm';

/**
 * Auto-create WorkOS user for guest booking
 * Creates user + personal organization (org-per-user model)
 *
 * Flow:
 * 1. Check if user exists by email
 * 2. If not, create WorkOS user (emailVerified: false)
 * 3. Create personal organization
 * 4. Create membership (owner role)
 * 5. Send magic link email for dashboard access
 *
 * @param params - Guest user parameters
 * @param params.email - Guest email address
 * @param params.name - Guest full name
 * @param params.metadata - Optional metadata for the user
 * @returns Object containing userId, organizationId, and isNewUser flag
 *
 * @example
 * ```typescript
 * const { userId, organizationId, isNewUser } = await createOrGetGuestUser({
 *   email: 'guest@example.com',
 *   name: 'John Doe',
 *   metadata: { bookingId: '123' }
 * });
 * ```
 */
export async function createOrGetGuestUser(params: {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}) {
  const { email, name, metadata } = params;

  try {
    // Check if user already exists in our database
    const existingUser = await db.query.UsersTable.findFirst({
      where: eq(UsersTable.email, email),
    });

    if (existingUser) {
      // Get active membership for existing user
      const membership = await db.query.UserOrgMembershipsTable.findFirst({
        where: (fields, { and, eq: eqOp }) =>
          and(eqOp(fields.workosUserId, existingUser.workosUserId), eqOp(fields.status, 'active')),
      });

      if (membership) {
        return {
          userId: existingUser.workosUserId,
          organizationId: membership.orgId,
          isNewUser: false,
        };
      }
    }

    // Split name into first/last
    const [firstName, ...lastNameParts] = name.trim().split(' ');
    const lastName = lastNameParts.join(' ') || '';

    // Create WorkOS user
    console.log(`Creating WorkOS user for guest: ${email}`);
    const workosUser = await workos.userManagement.createUser({
      email,
      firstName,
      lastName,
      emailVerified: false, // Guest hasn't verified yet
      metadata: {
        ...metadata,
        registrationType: 'guest',
        registeredAt: new Date().toISOString(),
      },
    });

    // Create personal organization
    const orgSlug = `user-${workosUser.id}`;
    console.log(`Creating personal organization for guest: ${orgSlug}`);
    const workosOrg = await workos.organizations.createOrganization({
      name: `${name.trim()}'s Account`,
      domainData: [], // No domain verification for guests
    });

    // Insert organization into database
    const [org] = await db
      .insert(OrganizationsTable)
      .values({
        workosOrgId: workosOrg.id,
        slug: orgSlug,
        name: `${name.trim()}'s Account`,
        type: 'patient_personal',
      })
      .returning();

    // Insert user into database (firstName/lastName are in ProfilesTable, not UsersTable)
    await db.insert(UsersTable).values({
      workosUserId: workosUser.id,
      email,
    });

    // Create WorkOS membership
    console.log(`Creating organization membership for guest in WorkOS`);
    await workos.userManagement.createOrganizationMembership({
      userId: workosUser.id,
      organizationId: workosOrg.id,
      roleSlug: 'owner',
    });

    // Insert membership into database
    await db.insert(UserOrgMembershipsTable).values({
      workosUserId: workosUser.id,
      orgId: org.id,
      role: 'owner',
      status: 'active',
    });

    // Send magic link for dashboard access (optional - user can access later)
    try {
      console.log(`Sending magic auth code to guest: ${email}`);
      await workos.userManagement.sendMagicAuthCode({
        email,
      });
    } catch (magicLinkError) {
      // Don't fail the registration if magic link fails
      console.error('Failed to send magic auth code to guest:', magicLinkError);
    }

    console.log(`✅ Guest user created successfully: ${workosUser.id}`);

    return {
      userId: workosUser.id,
      organizationId: org.id,
      isNewUser: true,
    };
  } catch (error) {
    console.error('❌ Failed to create guest user:', {
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Re-throw the error to be handled by the calling function
    throw error;
  }
}
