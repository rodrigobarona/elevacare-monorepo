import * as Sentry from '@sentry/nextjs';
import { isQStashAvailable, scheduleRecurringJob } from './client';
import { getQStashConfigMessage, initQStashClient, validateQStashConfig } from './config';

const { logger } = Sentry;

// Get the base URL for the app
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://eleva.care';

// Initialize QStash client with proper validation
const qstashClient = initQStashClient();
if (!qstashClient) {
  logger.error('Failed to initialize QStash client. Check your environment variables.');
}

/**
 * Delete all existing QStash schedules
 * @throws {Error} If QStash client is not initialized
 * @returns {Promise<void>}
 */
async function cleanupExistingSchedules() {
  if (!qstashClient) {
    throw new Error('QStash client is not initialized. Cannot cleanup schedules.');
  }

  try {
    logger.info('Cleaning up existing schedules');
    const schedules = await qstashClient.schedules.list();

    for (const schedule of schedules) {
      logger.debug(logger.fmt`Deleting schedule ${schedule.scheduleId}`);
      await qstashClient.schedules.delete(schedule.scheduleId);
    }

    logger.info(logger.fmt`Deleted ${schedules.length} schedules`);
  } catch (error) {
    logger.error('Failed to cleanup schedules', { error });
    Sentry.captureException(error);
    throw error;
  }
}

// This maps the cron jobs from vercel.json to QStash schedules
const SCHEDULE_CONFIGS = [
  {
    name: 'process-tasks',
    endpoint: '/api/cron/process-tasks',
    schedule: { cron: '0 4 * * *' }, // Daily at 4 AM
  },
  {
    name: 'process-expert-transfers',
    endpoint: '/api/cron/process-expert-transfers',
    schedule: { cron: '0 */2 * * *' }, // Every 2 hours (at minute 0)
  },
  {
    name: 'process-pending-payouts',
    endpoint: '/api/cron/process-pending-payouts',
    schedule: { cron: '0 6 * * *' }, // Daily at 6 AM
  },
  {
    name: 'check-upcoming-payouts',
    endpoint: '/api/cron/check-upcoming-payouts',
    schedule: { cron: '0 12 * * *' }, // Daily at noon
  },
  {
    name: 'cleanup-expired-reservations',
    endpoint: '/api/cron/cleanup-expired-reservations',
    schedule: { cron: '*/15 * * * *' }, // Every 15 minutes
  },
  {
    name: 'cleanup-blocked-dates',
    endpoint: '/api/cron/cleanup-blocked-dates',
    schedule: { cron: '0 0 * * *' }, // Daily at midnight UTC
  },
  {
    name: 'appointment-reminders',
    endpoint: '/api/cron/appointment-reminders',
    schedule: { cron: '0 9 * * *' }, // Daily at 9 AM
  },
  {
    name: 'send-payment-reminders',
    endpoint: '/api/cron/send-payment-reminders',
    schedule: { cron: '0 */6 * * *' }, // Every 6 hours (at minute 0)
  },
];

interface ScheduleResult {
  name: string;
  endpoint: string;
  scheduleId: string;
  success: boolean;
  error?: string;
}

/**
 * Setup all QStash schedules
 * This should be run on the server once or during deployment
 *
 * The function will:
 * 1. Validate QStash configuration
 * 2. Attempt to cleanup existing schedules (non-blocking)
 * 3. Create new schedules based on SCHEDULE_CONFIGS
 *
 * Note: Schedule creation will proceed even if cleanup fails,
 * as QStash handles duplicate schedules gracefully.
 */
export async function setupQStashSchedules(): Promise<ScheduleResult[]> {
  // Validate QStash configuration first
  const config = validateQStashConfig();
  const results: ScheduleResult[] = [];

  if (!config.isValid) {
    logger.warn('QStash configuration is incomplete or invalid', {
      message: getQStashConfigMessage(),
    });

    // Return empty results with error
    return SCHEDULE_CONFIGS.map((config) => ({
      name: config.name,
      endpoint: config.endpoint,
      scheduleId: '',
      success: false,
      error: 'QStash is not properly configured. Missing environment variables.',
    }));
  }

  // Ensure QStash client is available
  if (!isQStashAvailable()) {
    logger.error('QStash client is not available. Cannot set up schedules.');

    return SCHEDULE_CONFIGS.map((config) => ({
      name: config.name,
      endpoint: config.endpoint,
      scheduleId: '',
      success: false,
      error: 'QStash client is not initialized properly.',
    }));
  }

  // First, attempt to cleanup existing schedules
  // This is non-blocking - we'll proceed with schedule creation even if cleanup fails
  try {
    await cleanupExistingSchedules();
  } catch (error) {
    logger.error('Failed to cleanup existing schedules', { error });
    Sentry.captureException(error);
    logger.info('Proceeding with schedule creation despite cleanup failure');
    // We continue with schedule creation because:
    // 1. QStash handles duplicate schedules gracefully
    // 2. Better to have duplicate schedules than no schedules
    // 3. Failed cleanup likely indicates temporary API issues
  }

  // Proceed with schedule creation
  for (const config of SCHEDULE_CONFIGS) {
    try {
      // Construct the full URL for the target endpoint
      const destinationUrl = `${BASE_URL}${config.endpoint}`;

      logger.info(logger.fmt`Setting up QStash schedule for ${config.name} at endpoint ${destinationUrl}`);

      // Schedule the job with correct parameter order and types
      const scheduleId = await scheduleRecurringJob(
        destinationUrl,
        // Merge the schedule config with other options
        {
          ...config.schedule,
          retries: 3,
        },
        // Body as the third parameter - include headers to pass through middleware
        {
          name: config.name,
          headers: {
            'x-qstash-request': 'true',
          },
        },
      );

      // Record the result
      results.push({
        name: config.name,
        endpoint: config.endpoint,
        scheduleId,
        success: true,
      });

      logger.info(logger.fmt`Successfully scheduled ${config.name} job`, {
        scheduleId,
        endpoint: config.endpoint,
        schedule: config.schedule,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record the failure
      results.push({
        name: config.name,
        endpoint: config.endpoint,
        scheduleId: '',
        success: false,
        error: errorMessage,
      });

      logger.error(logger.fmt`Failed to schedule ${config.name} job`, { error });
      Sentry.captureException(error, { extra: { jobName: config.name } });
    }
  }

  return results;
}
