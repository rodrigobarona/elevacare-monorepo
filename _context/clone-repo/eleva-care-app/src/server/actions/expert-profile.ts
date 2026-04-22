'use server';

import * as Sentry from '@sentry/nextjs';
import { PRACTITIONER_AGREEMENT_CONFIG } from '@/config/legal-agreements';

const { logger } = Sentry;
import { db, invalidateCache } from '@/drizzle/db';
import { ProfilesTable } from '@/drizzle/schema';
import { hasRole } from '@/lib/auth/roles.server';
import { logAuditEvent } from '@/lib/utils/server/audit';
import { getRequestMetadata } from '@/lib/utils/server/server-utils';
import { checkExpertSetupStatus } from '@/server/actions/expert-setup';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';

/**
 * Toggles the publication status of an expert profile.
 * When publishing for the first time, verifies that all expert setup steps are complete.
 */
export async function toggleProfilePublication() {
  return Sentry.withServerActionInstrumentation('toggleProfilePublication', { recordResponse: true }, async () => {
  const { user } = await withAuth();
  const userId = user?.id;

  if (!userId || !user) {
    return { success: false, message: 'Not authenticated', isPublished: false };
  }

  // Check if user has expert role
  const isExpert = (await hasRole('expert_community')) || (await hasRole('expert_top'));
  if (!isExpert) {
    return { success: false, message: 'Not authorized', isPublished: false };
  }

  try {
    // Get current profile
    const profile = await db.query.ProfilesTable.findFirst({
      where: eq(ProfilesTable.workosUserId, userId),
    });

    if (!profile) {
      return { success: false, message: 'Profile not found', isPublished: false };
    }

    // Calculate the target publication status
    const targetPublishedStatus = !profile.published;

    // If trying to publish (not unpublish), check if all steps are complete
    if (targetPublishedStatus === true) {
      // Check if all expert setup steps are complete
      const setupStatus = await checkExpertSetupStatus();

      // Handle different response structures
      const setupSteps = setupStatus.setupStatus || {};
      const allStepsComplete = Object.values(setupSteps).every(Boolean);

      if (!allStepsComplete) {
        // Create list of incomplete steps
        const incompleteSteps = Object.entries(setupSteps)
          .filter(([_, complete]) => !complete)
          .map(([step]) => step);

        return {
          success: false,
          message: 'Cannot publish profile until all setup steps are complete',
          isPublished: false,
          incompleteSteps,
        };
      }
    }
    // If unpublishing, we don't need to check for completion status - allow it regardless

    // Prepare update data
    const updateData: {
      published: boolean;
      practitionerAgreementAcceptedAt?: Date;
      practitionerAgreementVersion?: string;
      practitionerAgreementIpAddress?: string;
    } = {
      published: targetPublishedStatus,
    };

    // If publishing for the first time, record agreement acceptance
    if (targetPublishedStatus === true && !profile.practitionerAgreementAcceptedAt) {
      const { ipAddress } = await getRequestMetadata();
      updateData.practitionerAgreementAcceptedAt = new Date();
      updateData.practitionerAgreementVersion = PRACTITIONER_AGREEMENT_CONFIG.version;
      updateData.practitionerAgreementIpAddress = ipAddress;
    }

    // Update the published status (and agreement data if first time publishing)
    await db.update(ProfilesTable).set(updateData).where(eq(ProfilesTable.workosUserId, userId));

    await invalidateCache([`expert-profile-${userId}`]);

    // Log to audit database (user context automatically extracted)
    try {
      if (targetPublishedStatus === true) {
        // Log profile publication
        await logAuditEvent(
          'PROFILE_UPDATED',
          'profile',
          profile.id,
          {
            oldValues: { published: false },
            newValues: {
              published: true,
              publishedAt: new Date().toISOString(),
              expertName: `${user.firstName} ${user.lastName}`,
            },
          },
          { action: 'publish' },
        );

        // Log agreement acceptance (if first time)
        if (!profile.practitionerAgreementAcceptedAt) {
          await logAuditEvent(
            'COMPLIANCE_REPORT_GENERATED',
            'compliance',
            `expert-agreement-${profile.id}`,
            {
              newValues: {
                agreementType: 'practitioner_agreement',
                version: PRACTITIONER_AGREEMENT_CONFIG.version,
                acceptedAt: new Date().toISOString(),
                documentPath: PRACTITIONER_AGREEMENT_CONFIG.documentPath,
                expertName: `${user.firstName} ${user.lastName}`,
              },
            },
            { consentType: 'practitioner_agreement' },
          );
        }
      } else {
        // Log profile unpublication
        await logAuditEvent(
          'PROFILE_UPDATED',
          'profile',
          profile.id,
          {
            oldValues: { published: true },
            newValues: {
              published: false,
              unpublishedAt: new Date().toISOString(),
              expertName: `${user.firstName} ${user.lastName}`,
            },
          },
          { action: 'unpublish' },
        );
      }
    } catch (auditError) {
      // Log error but don't fail the operation
      logger.error('Failed to log audit event for profile publication', { error: auditError });
    }

    updateTag('experts');
    updateTag(`expert-${userId}`);

    return {
      success: true,
      message: targetPublishedStatus ? 'Profile published successfully' : 'Profile unpublished',
      isPublished: targetPublishedStatus,
    };
  } catch (error) {
    logger.error('Error toggling profile publication', { error });
    return {
      success: false,
      message: 'Failed to update profile publication status',
      isPublished: false,
    };
  }
  });
}
