/**
 * WorkOS Webhook Handler
 *
 * Handles real-time synchronization events from WorkOS.
 * Ensures database stays in sync with WorkOS (single source of truth).
 *
 * Supported Events:
 * - user.created - New user registered
 * - user.updated - User profile changed
 * - user.deleted - User account deleted
 * - organization_membership.created - User joined org
 * - organization_membership.updated - Membership role changed
 * - organization_membership.deleted - User left org
 * - dsync.user.created/updated/deleted - Directory Sync events
 *
 * Security:
 * - Verifies webhook signatures using WORKOS_WEBHOOK_SECRET
 * - Returns 401 for invalid signatures
 * - Returns 200 quickly to acknowledge receipt
 *
 * @see https://workos.com/docs/user-management/webhooks
 */
import { ENV_CONFIG } from '@/config/env';
import {
  deleteUserFromDatabase,
  fullUserSync,
  syncUserOrgMembership,
  syncWorkOSOrganizationToDatabase,
} from '@/lib/integrations/workos/sync';
import type { Event, OrganizationMembership } from '@workos-inc/node';
import { WorkOS } from '@workos-inc/node';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

const { logger } = Sentry;

// Initialize WorkOS client for webhook verification
const workos = new WorkOS(ENV_CONFIG.WORKOS_API_KEY);

/**
 * POST handler for WorkOS webhooks
 *
 * Processes webhook events and syncs data to database.
 * Returns 200 quickly to prevent timeout.
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook payload and signature
    const payload = await request.text();
    const signature = request.headers.get('workos-signature');

    if (!signature) {
      logger.error('Missing WorkOS signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Verify webhook signature
    let event: any;
    try {
      event = await workos.webhooks.constructEvent({
        payload,
        sigHeader: signature,
        secret: ENV_CONFIG.WORKOS_WEBHOOK_SECRET,
      });
    } catch (error) {
      logger.error('Invalid webhook signature', { error });
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    logger.info(logger.fmt`WorkOS webhook received: ${event.event}`);
    logger.info(logger.fmt`Event ID: ${event.id}`);

    // Handle event based on type
    switch (event.event) {
      // ========================================================================
      // USER EVENTS
      // ========================================================================

      case 'user.created': {
        const user = event.data;
        logger.info(logger.fmt`New user created: ${user.email}`);

        const result = await fullUserSync(user.id);

        if (!result.success) {
          logger.error('Failed to sync new user', { error: result.error });
        }

        break;
      }

      case 'user.updated': {
        const user = event.data;
        logger.info(logger.fmt`User updated: ${user.email}`);

        const result = await fullUserSync(user.id);

        if (!result.success) {
          logger.error('Failed to sync updated user', { error: result.error });
        }

        break;
      }

      case 'user.deleted': {
        const user = event.data;
        logger.info(logger.fmt`User deleted: ${user.id}`);

        const result = await deleteUserFromDatabase(user.id);

        if (!result.success) {
          logger.error('Failed to delete user', { error: result.error });
        }

        break;
      }

      // ========================================================================
      // ORGANIZATION MEMBERSHIP EVENTS
      // ========================================================================

      case 'organization_membership.created': {
        const membership = event.data as OrganizationMembership;
        logger.info(
          logger.fmt`Membership created: user ${membership.userId} -> org ${membership.organizationId}`,
        );

        // Sync membership to database
        const result = await syncUserOrgMembership(membership);

        if (!result.success) {
          logger.error('Failed to sync membership', { error: result.error });
        }

        break;
      }

      case 'organization_membership.updated': {
        const membership = event.data as OrganizationMembership;
        logger.info(
          logger.fmt`Membership updated: user ${membership.userId} -> org ${membership.organizationId}`,
        );

        // Re-sync membership (handles role changes)
        const result = await syncUserOrgMembership(membership);

        if (!result.success) {
          logger.error('Failed to sync membership update', { error: result.error });
        }

        break;
      }

      case 'organization_membership.deleted': {
        const membership = event.data as OrganizationMembership;
        logger.info(
          logger.fmt`Membership deleted: user ${membership.userId} -> org ${membership.organizationId}`,
        );

        // TODO: Delete membership from database
        // This will be implemented in Phase 5
        logger.warn('Membership deletion not yet implemented');

        break;
      }

      // ========================================================================
      // DIRECTORY SYNC EVENTS (for Enterprise SSO)
      // ========================================================================

      case 'dsync.user.created': {
        const user = event.data;
        logger.info(logger.fmt`Directory Sync - User created: ${user.email}`);

        // Sync directory user same as regular user
        const result = await fullUserSync(user.id);

        if (!result.success) {
          logger.error('Failed to sync directory user', { error: result.error });
        }

        break;
      }

      case 'dsync.user.updated': {
        const user = event.data;
        logger.info(logger.fmt`Directory Sync - User updated: ${user.email}`);

        const result = await fullUserSync(user.id);

        if (!result.success) {
          logger.error('Failed to sync directory user update', { error: result.error });
        }

        break;
      }

      case 'dsync.user.deleted': {
        const user = event.data;
        logger.info(logger.fmt`Directory Sync - User deleted: ${user.id}`);

        const result = await deleteUserFromDatabase(user.id);

        if (!result.success) {
          logger.error('Failed to delete directory user', { error: result.error });
        }

        break;
      }

      // ========================================================================
      // ORGANIZATION EVENTS (Phase 5)
      // ========================================================================

      case 'organization.created': {
        const org = event.data;
        logger.info(logger.fmt`Organization created: ${org.name}`);

        // Sync organization to database
        const result = await syncWorkOSOrganizationToDatabase(
          {
            id: org.id,
            name: org.name,
            domains: org.domains,
          },
          'patient_personal', // Default type, can be updated later
        );

        if (!result.success) {
          logger.error('Failed to sync organization', { error: result.error });
        }

        break;
      }

      case 'organization.updated': {
        const org = event.data;
        logger.info(logger.fmt`Organization updated: ${org.name}`);

        // Re-sync organization data
        const result = await syncWorkOSOrganizationToDatabase(
          {
            id: org.id,
            name: org.name,
            domains: org.domains,
          },
          'patient_personal', // Type should be preserved from existing record
        );

        if (!result.success) {
          logger.error('Failed to sync organization update', { error: result.error });
        }

        break;
      }

      case 'organization.deleted': {
        const org = event.data;
        logger.info(logger.fmt`Organization deleted: ${org.id}`);

        // TODO: Delete organization from database
        // This will be implemented in Phase 5
        logger.warn('Organization deletion not yet implemented');

        break;
      }

      // ========================================================================
      // UNKNOWN EVENTS
      // ========================================================================

      default:
        logger.warn(logger.fmt`Unhandled webhook event: ${event.event}`);
    }

    // Always return 200 to acknowledge receipt
    // This prevents WorkOS from retrying
    return NextResponse.json(
      {
        received: true,
        event: event.event,
        id: event.id,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error('Error processing WorkOS webhook', { error });
    Sentry.captureException(error);

    // Return 500 to trigger retry from WorkOS
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler - Returns info about webhook endpoint
 * Useful for health checks and debugging
 */
export async function GET() {
  return NextResponse.json({
    service: 'WorkOS Webhook Handler',
    status: 'active',
    events: [
      'user.created',
      'user.updated',
      'user.deleted',
      'organization_membership.created',
      'organization_membership.updated',
      'organization_membership.deleted',
      'dsync.user.created',
      'dsync.user.updated',
      'dsync.user.deleted',
      'organization.created',
      'organization.updated',
      'organization.deleted',
    ],
    documentation: 'https://workos.com/docs/user-management/webhooks',
  });
}
