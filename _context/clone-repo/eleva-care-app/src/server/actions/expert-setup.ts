/**
 * Expert Setup Server Actions (WorkOS)
 *
 * Manages expert onboarding progress in database (replaces user metadata storage).
 *
 * Benefits over auth provider metadata:
 * - Queryable: Can find all incomplete setups
 * - Indexed: Fast filtering for analytics
 * - Audit trail: Track completion dates
 * - No size limits: Store unlimited data
 * - No API calls: Direct database access
 */

'use server';

import { db } from '@/drizzle/db';
import * as Sentry from '@sentry/nextjs';
import { ExpertSetupTable } from '@/drizzle/schema';
import type { SetupStats, SetupStatus, SetupStepType } from '@/types/expert-setup';
import { SetupStep } from '@/types/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { count, eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';

/**
 * Expert Setup Server Actions (WorkOS)
 *
 * Manages expert onboarding progress in database (replaces user metadata storage).
 *
 * Benefits over auth provider metadata:
 * - Queryable: Can find all incomplete setups
 * - Indexed: Fast filtering for analytics
 * - Audit trail: Track completion dates
 * - No size limits: Store unlimited data
 * - No API calls: Direct database access
 */

/**
 * Get expert setup status from database
 *
 * Fetches the current setup progress for the authenticated user.
 * If no setup record exists, creates one with all steps incomplete.
 *
 * @returns Setup status and completion flag
 *
 * @example
 * ```tsx
 * // In Server Component or Server Action
 * const { setupStatus, isSetupComplete } = await checkExpertSetupStatus();
 *
 * if (!isSetupComplete) {
 *   return <SetupWizard status={setupStatus} />;
 * }
 * ```
 */
export async function checkExpertSetupStatus(): Promise<{
  setupStatus: SetupStatus;
  isSetupComplete: boolean;
  setupCompletedAt: Date | null;
}> {
  return Sentry.withServerActionInstrumentation('checkExpertSetupStatus', { recordResponse: true }, async () => {
  const { user } = await withAuth({ ensureSignedIn: true });

  // Try to fetch existing setup record
  const setup = await db.query.ExpertSetupTable.findFirst({
    where: eq(ExpertSetupTable.workosUserId, user.id),
  });

  // If no setup record exists, create one
  if (!setup) {
    await db.insert(ExpertSetupTable).values({
      workosUserId: user.id,
      orgId: null, // Organization ID not required for setup table
    });

    return {
      setupStatus: {
        profile: false,
        availability: false,
        events: false,
        identity: false,
        payment: false,
        google_account: false,
      },
      isSetupComplete: false,
      setupCompletedAt: null,
    };
  }

  // Return existing setup status
  return {
    setupStatus: {
      profile: setup.profileCompleted,
      availability: setup.availabilityCompleted,
      events: setup.eventsCompleted,
      identity: setup.identityCompleted,
      payment: setup.paymentCompleted,
      google_account: setup.googleAccountCompleted,
    },
    isSetupComplete: setup.setupComplete,
    setupCompletedAt: setup.setupCompletedAt,
  };
  });
}

/**
 * Mark a setup step as complete
 *
 * Updates the database and checks if all steps are now complete.
 * If all steps are complete, sets setupComplete flag and timestamp.
 *
 * @param step - Setup step to mark complete
 *
 * @example
 * ```ts
 * 'use server';
 *
 * export async function completeProfileSetup() {
 *   await markStepComplete('profile');
 * }
 * ```
 */
export async function markStepComplete(step: SetupStepType): Promise<void> {
  return Sentry.withServerActionInstrumentation('markStepComplete', { recordResponse: true }, async () => {
  // Validate step name
  const validatedStep = SetupStep.parse(step);

  const { user } = await withAuth({ ensureSignedIn: true });

  // Map step name to database column
  const columnMap: Record<SetupStepType, keyof typeof ExpertSetupTable.$inferInsert> = {
    profile: 'profileCompleted',
    availability: 'availabilityCompleted',
    events: 'eventsCompleted',
    identity: 'identityCompleted',
    payment: 'paymentCompleted',
    google_account: 'googleAccountCompleted',
  };

  const columnName = columnMap[validatedStep];

  // Fetch current setup
  const setup = await db.query.ExpertSetupTable.findFirst({
    where: eq(ExpertSetupTable.workosUserId, user.id),
  });

  if (!setup) {
    throw new Error('Setup record not found. Please refresh the page.');
  }

  // Update the specific step
  await db
    .update(ExpertSetupTable)
    .set({ [columnName]: true })
    .where(eq(ExpertSetupTable.workosUserId, user.id));

  // Check if all steps are now complete
  const updatedSetup = await db.query.ExpertSetupTable.findFirst({
    where: eq(ExpertSetupTable.workosUserId, user.id),
  });

  if (updatedSetup) {
    const allComplete =
      updatedSetup.profileCompleted &&
      updatedSetup.availabilityCompleted &&
      updatedSetup.eventsCompleted &&
      updatedSetup.identityCompleted &&
      updatedSetup.paymentCompleted &&
      updatedSetup.googleAccountCompleted;

    // If all steps complete and not already marked, update setupComplete
    if (allComplete && !updatedSetup.setupComplete) {
      await db
        .update(ExpertSetupTable)
        .set({
          setupComplete: true,
          setupCompletedAt: new Date(),
        })
        .where(eq(ExpertSetupTable.workosUserId, user.id));
    }
  }

  updateTag('expert-setup');
  updateTag(`expert-setup-${user.id}`);
  });
}

/**
 * Mark a setup step as incomplete (for admin or testing)
 *
 * @param step - Setup step to mark incomplete
 */
export async function markStepIncomplete(step: SetupStepType): Promise<void> {
  return Sentry.withServerActionInstrumentation('markStepIncomplete', { recordResponse: true }, async () => {
  const validatedStep = SetupStep.parse(step);
  const { user } = await withAuth({ ensureSignedIn: true });

  const columnMap: Record<SetupStepType, keyof typeof ExpertSetupTable.$inferInsert> = {
    profile: 'profileCompleted',
    availability: 'availabilityCompleted',
    events: 'eventsCompleted',
    identity: 'identityCompleted',
    payment: 'paymentCompleted',
    google_account: 'googleAccountCompleted',
  };

  const columnName = columnMap[validatedStep];

  await db
    .update(ExpertSetupTable)
    .set({
      [columnName]: false,
      setupComplete: false, // Automatically mark setup as incomplete
      setupCompletedAt: null,
    })
    .where(eq(ExpertSetupTable.workosUserId, user.id));

  updateTag('expert-setup');
  updateTag(`expert-setup-${user.id}`);
  });
}

/**
 * Reset all setup steps to incomplete
 *
 * Useful for testing or if an expert needs to re-do setup.
 * Requires admin permissions.
 *
 * @param workosUserId - User ID to reset (optional, defaults to current user)
 */
export async function resetSetup(workosUserId?: string): Promise<void> {
  return Sentry.withServerActionInstrumentation('resetSetup', { recordResponse: true }, async () => {
  const { user } = await withAuth({ ensureSignedIn: true });

  // TODO: Add admin permission check
  // const isAdmin = await isUserAdmin(user.id);
  // if (!isAdmin && workosUserId && workosUserId !== user.id) {
  //   throw new Error('Unauthorized: Only admins can reset other users\' setup');
  // }

  const targetUserId = workosUserId || user.id;

  await db
    .update(ExpertSetupTable)
    .set({
      profileCompleted: false,
      availabilityCompleted: false,
      eventsCompleted: false,
      identityCompleted: false,
      paymentCompleted: false,
      googleAccountCompleted: false,
      setupComplete: false,
      setupCompletedAt: null,
    })
    .where(eq(ExpertSetupTable.workosUserId, targetUserId));

  updateTag('expert-setup');
  updateTag(`expert-setup-${targetUserId}`);
  });
}

/**
 * Get list of experts with incomplete setup (Admin only)
 *
 * Useful for admin dashboard to track expert onboarding.
 *
 * @returns Array of users with incomplete setup
 */
export async function getIncompleteExperts(): Promise<
  Array<{
    workosUserId: string;
    setupStatus: SetupStatus;
    createdAt: Date;
  }>
> {
  return Sentry.withServerActionInstrumentation('getIncompleteExperts', { recordResponse: true }, async () => {
  // TODO: Add authentication and admin permission check
  // const session = await requireAuth();
  // const isAdmin = await isUserAdmin(session.userId);
  // if (!isAdmin) {
  //   throw new Error('Unauthorized: Only admins can view incomplete experts');
  // }

  const incompleteSetups = await db.query.ExpertSetupTable.findMany({
    where: eq(ExpertSetupTable.setupComplete, false),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: 100, // Prevent huge queries
  });

  return incompleteSetups.map((setup) => ({
    workosUserId: setup.workosUserId,
    setupStatus: {
      profile: setup.profileCompleted,
      availability: setup.availabilityCompleted,
      events: setup.eventsCompleted,
      identity: setup.identityCompleted,
      payment: setup.paymentCompleted,
      google_account: setup.googleAccountCompleted,
    },
    createdAt: setup.createdAt,
  }));
  });
}

/**
 * Get setup completion statistics (Admin only)
 *
 * Provides analytics on expert onboarding progress.
 *
 * @returns Setup statistics
 */
export async function getSetupStats(): Promise<SetupStats> {
  return Sentry.withServerActionInstrumentation('getSetupStats', { recordResponse: true }, async () => {
  // TODO: Add authentication and admin permission check
  // const session = await requireAuth();
  // const isAdmin = await isUserAdmin(session.userId);
  // if (!isAdmin) throw new Error('Unauthorized: Only admins can view stats');

  // Get total count
  const totalResult = await db.select({ count: count() }).from(ExpertSetupTable);

  const total = totalResult[0]?.count || 0;

  if (total === 0) {
    return {
      total: 0,
      complete: 0,
      incomplete: 0,
      completionRate: 0,
      averageStepsCompleted: 0,
    };
  }

  // Get complete count
  const completeResult = await db
    .select({ count: count() })
    .from(ExpertSetupTable)
    .where(eq(ExpertSetupTable.setupComplete, true));

  const complete = completeResult[0]?.count || 0;
  const incomplete = total - complete;
  const completionRate = (complete / total) * 100;

  // Calculate average steps completed (for incomplete setups)
  const allSetups = await db.query.ExpertSetupTable.findMany();

  const totalStepsCompleted = allSetups.reduce((sum, setup) => {
    return (
      sum +
      (setup.profileCompleted ? 1 : 0) +
      (setup.availabilityCompleted ? 1 : 0) +
      (setup.eventsCompleted ? 1 : 0) +
      (setup.identityCompleted ? 1 : 0) +
      (setup.paymentCompleted ? 1 : 0) +
      (setup.googleAccountCompleted ? 1 : 0)
    );
  }, 0);

  const averageStepsCompleted = totalStepsCompleted / total;

  return {
    total,
    complete,
    incomplete,
    completionRate: Math.round(completionRate * 10) / 10, // Round to 1 decimal
    averageStepsCompleted: Math.round(averageStepsCompleted * 10) / 10,
  };
  });
}
