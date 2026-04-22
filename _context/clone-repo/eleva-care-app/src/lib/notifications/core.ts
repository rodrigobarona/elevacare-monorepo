import { triggerWorkflow } from '@/lib/integrations/novu/client';
import {
  NOTIFICATION_TYPE_ACCOUNT_UPDATE,
  NOTIFICATION_TYPE_SECURITY_ALERT,
  NOTIFICATION_TYPE_SYSTEM_MESSAGE,
  NOTIFICATION_TYPE_VERIFICATION_HELP,
  type NotificationType,
} from '@/lib/constants/notifications';
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

/**
 * Creates a new notification for a user via Novu workflows
 *
 * @param params Notification parameters
 * @returns Boolean indicating if the workflow trigger was successful.
 */
export async function createUserNotification(params: CreateNotificationParams): Promise<boolean> {
  try {
    const { userId, type, data = {} } = params;

    // Map notification type to workflow and trigger using proper Novu client
    switch (type) {
      case NOTIFICATION_TYPE_VERIFICATION_HELP:
        await triggerWorkflow({
          workflowId: 'security-auth',
          to: {
            subscriberId: userId,
            ...(data.email ? { email: data.email as string } : {}),
            ...(data.firstName ? { firstName: data.firstName as string } : {}),
          },
          payload: {
            eventType: 'account-verification',
            userId,
            verificationUrl: (data.verificationUrl as string) || undefined,
            ...data,
          },
        });
        break;

      case NOTIFICATION_TYPE_ACCOUNT_UPDATE:
        await triggerWorkflow({
          workflowId: 'user-lifecycle',
          to: {
            subscriberId: userId,
            ...(data.email ? { email: data.email as string } : {}),
            ...(data.firstName ? { firstName: data.firstName as string } : {}),
          },
          payload: {
            eventType: 'welcome',
            userName: (data.userName as string) || 'User',
            ...data,
          },
        });
        break;

      case NOTIFICATION_TYPE_SECURITY_ALERT:
        await triggerWorkflow({
          workflowId: 'security-auth',
          to: {
            subscriberId: userId,
            ...(data.email ? { email: data.email as string } : {}),
            ...(data.firstName ? { firstName: data.firstName as string } : {}),
          },
          payload: {
            eventType: 'security-alert',
            userId,
            alertType: (data.alertType as string) || undefined,
            message: (data.message as string) || 'Security alert notification',
            ...data,
          },
        });
        break;

      case NOTIFICATION_TYPE_SYSTEM_MESSAGE:
        await triggerWorkflow({
          workflowId: 'security-auth',
          to: {
            subscriberId: userId,
            ...(data.email ? { email: data.email as string } : {}),
            ...(data.firstName ? { firstName: data.firstName as string } : {}),
          },
          payload: {
            eventType: 'security-alert',
            userId,
            alertType: 'system',
            message: (data.message as string) || 'System message',
            ...data,
          },
        });
        break;

      default:
        logger.warn(logger.fmt`No workflow mapping for notification type: ${type}. Notification not sent.`);
        return false;
    }

    logger.info(logger.fmt`Novu workflow triggered successfully for type: ${type}, user: ${userId}`);
    return true;
  } catch (novuError) {
    logger.error('Error triggering notification workflow', { error: novuError });
    Sentry.captureException(novuError);
    return false;
  }
}
