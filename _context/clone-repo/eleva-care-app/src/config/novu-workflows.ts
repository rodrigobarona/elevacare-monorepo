/**
 * Novu Workflow ID Constants
 *
 * This file contains all workflow IDs used in the application.
 * These MUST match the workflow IDs defined in config/novu.ts
 *
 * Usage:
 * import { WORKFLOW_IDS } from '@/config/novu-workflows';
 * await triggerWorkflow({ workflowId: WORKFLOW_IDS.PAYOUT_NOTIFICATION, ... });
 */

export const WORKFLOW_IDS = {
  // User & Authentication
  // NOTE: user-lifecycle handles welcome emails with idempotency via welcomeEmailSentAt field
  // Only triggers on user.created event and checks database before sending
  USER_LIFECYCLE: 'user-lifecycle', // Includes welcome email (idempotent via UserTable.welcomeEmailSentAt)
  SECURITY_AUTH: 'security-auth',

  // DEPRECATED: Use USER_LIFECYCLE instead - kept for backwards compatibility
  USER_WELCOME: 'user-lifecycle', // Maps to USER_LIFECYCLE (same workflow ID)
  USER_LOGIN_NOTIFICATION: 'user-login-notification',

  // Payments & Payouts
  PAYMENT_UNIVERSAL: 'payment-universal',
  PAYMENT_SUCCESS: 'payment-success',
  PAYMENT_FAILED: 'payment-failed',
  EXPERT_PAYOUT_NOTIFICATION: 'expert-payout-notification',

  // Appointments
  APPOINTMENT_UNIVERSAL: 'appointment-universal',
  APPOINTMENT_CONFIRMATION: 'appointment-confirmation',
  APPOINTMENT_REMINDER_24HR: 'appointment-reminder-24hr',

  // Multibanco Payments
  MULTIBANCO_BOOKING_PENDING: 'multibanco-booking-pending',
  MULTIBANCO_PAYMENT_REMINDER: 'multibanco-payment-reminder',

  // Expert Management
  EXPERT_MANAGEMENT: 'expert-management',
  EXPERT_ACCOUNT_UPDATED: 'expert-account-updated',

  // Platform Payments
  PLATFORM_PAYMENTS_UNIVERSAL: 'platform-payments-universal',

  // System Health
  SYSTEM_HEALTH: 'system-health',
} as const;

/**
 * Type for workflow IDs - ensures only valid workflow IDs can be used
 */
export type WorkflowId = (typeof WORKFLOW_IDS)[keyof typeof WORKFLOW_IDS];

/**
 * Mapping from old/inconsistent workflow IDs to new standardized ones
 * Use this to migrate existing code gradually
 *
 * NOTE: user-welcome is DEPRECATED - it maps to user-lifecycle
 * The user-lifecycle workflow has built-in idempotency via UserTable.welcomeEmailSentAt
 */
export const WORKFLOW_ID_MAPPINGS = {
  // Old ID -> New standardized ID
  'health-check-failure': WORKFLOW_IDS.SYSTEM_HEALTH,
  'appointment-reminder': WORKFLOW_IDS.APPOINTMENT_UNIVERSAL,
  'user-created': WORKFLOW_IDS.USER_LIFECYCLE,
  'recent-login-v2': WORKFLOW_IDS.USER_LOGIN_NOTIFICATION,
  'user-welcome': WORKFLOW_IDS.USER_LIFECYCLE, // DEPRECATED: Maps to user-lifecycle
} as const;

/**
 * Validate that a workflow ID is valid
 */
export function isValidWorkflowId(id: string): id is WorkflowId {
  return Object.values(WORKFLOW_IDS).includes(id as WorkflowId);
}

/**
 * Get all workflow IDs as an array
 */
export function getAllWorkflowIds(): WorkflowId[] {
  return Object.values(WORKFLOW_IDS);
}

/**
 * Get the correct workflow ID, handling legacy mappings
 */
export function getStandardWorkflowId(workflowId: string): WorkflowId | undefined {
  // Check if it's already a standard ID
  if (Object.values(WORKFLOW_IDS).includes(workflowId as WorkflowId)) {
    return workflowId as WorkflowId;
  }

  // Check legacy mappings
  return WORKFLOW_ID_MAPPINGS[workflowId as keyof typeof WORKFLOW_ID_MAPPINGS];
}

/**
 * Workflow categories for organization
 *
 * NOTE: USER_WELCOME is deprecated and maps to USER_LIFECYCLE
 * All welcome emails use USER_LIFECYCLE with idempotency tracking
 */
export const WORKFLOW_CATEGORIES = {
  AUTH: [
    WORKFLOW_IDS.USER_LIFECYCLE, // Handles welcome emails (idempotent)
    WORKFLOW_IDS.SECURITY_AUTH,
    WORKFLOW_IDS.USER_LOGIN_NOTIFICATION,
    // USER_WELCOME is deprecated - use USER_LIFECYCLE
  ],
  PAYMENTS: [
    WORKFLOW_IDS.PAYMENT_UNIVERSAL,
    WORKFLOW_IDS.PAYMENT_SUCCESS,
    WORKFLOW_IDS.PAYMENT_FAILED,
    WORKFLOW_IDS.EXPERT_PAYOUT_NOTIFICATION,
    WORKFLOW_IDS.MULTIBANCO_BOOKING_PENDING,
    WORKFLOW_IDS.MULTIBANCO_PAYMENT_REMINDER,
  ],
  APPOINTMENTS: [
    WORKFLOW_IDS.APPOINTMENT_UNIVERSAL,
    WORKFLOW_IDS.APPOINTMENT_CONFIRMATION,
    WORKFLOW_IDS.APPOINTMENT_REMINDER_24HR,
  ],
  EXPERTS: [
    WORKFLOW_IDS.EXPERT_MANAGEMENT,
    WORKFLOW_IDS.PLATFORM_PAYMENTS_UNIVERSAL,
    WORKFLOW_IDS.EXPERT_ACCOUNT_UPDATED,
  ],
  SYSTEM: [WORKFLOW_IDS.SYSTEM_HEALTH],
} as const;
