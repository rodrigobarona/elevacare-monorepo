/**
 * BetterStack Heartbeat Utility
 *
 * Centralized utility for sending heartbeat notifications to BetterStack.
 * Follows production best practices:
 * - Resilient: Heartbeat failures don't break the main job
 * - Observable: Logs all heartbeat attempts for debugging
 * - Reusable: Single source of truth for all heartbeat logic
 * - Type-safe: Full TypeScript support
 */
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

interface HeartbeatOptions {
  /**
   * The BetterStack heartbeat URL
   * Example: 'https://uptime.betterstack.com/api/v1/heartbeat/5JQa6JD74ZgvDj1yrDy2oDJt'
   */
  url: string;

  /**
   * Job name for logging purposes
   */
  jobName: string;

  /**
   * Optional timeout for the heartbeat request (default: 5000ms)
   */
  timeout?: number;
}

interface HeartbeatResult {
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Send a success heartbeat to BetterStack
 *
 * @param options - Heartbeat configuration
 * @returns Result of the heartbeat notification
 *
 * @example
 * ```typescript
 * await sendHeartbeatSuccess({
 *   url: process.env.BETTERSTACK_HEARTBEAT_URL,
 *   jobName: 'Expert Payout Processing',
 * });
 * ```
 */
export async function sendHeartbeatSuccess(options: HeartbeatOptions): Promise<HeartbeatResult> {
  const { url, jobName, timeout = 5000 } = options;

  if (!url) {
    logger.warn(logger.fmt`[${jobName}] Heartbeat URL not configured - skipping heartbeat`);
    return {
      success: false,
      message: 'Heartbeat URL not configured',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info(logger.fmt`[${jobName}] Heartbeat sent successfully`);
      return {
        success: true,
        message: 'Heartbeat sent successfully',
        timestamp: new Date().toISOString(),
      };
    } else {
      logger.error(logger.fmt`[${jobName}] Heartbeat failed with status ${response.status}: ${response.statusText}`);
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    // Log error but don't throw - heartbeat failures shouldn't break the main job
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(logger.fmt`[${jobName}] Failed to send heartbeat: ${errorMessage}`);

    return {
      success: false,
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Send a failure heartbeat to BetterStack
 *
 * Reports that the job failed, triggering an immediate alert
 *
 * @param options - Heartbeat configuration
 * @param error - The error that caused the failure
 * @returns Result of the heartbeat notification
 *
 * @example
 * ```typescript
 * try {
 *   await processPayouts();
 * } catch (error) {
 *   await sendHeartbeatFailure({
 *     url: process.env.BETTERSTACK_HEARTBEAT_URL,
 *     jobName: 'Expert Payout Processing',
 *   }, error);
 *   throw error;
 * }
 * ```
 */
export async function sendHeartbeatFailure(
  options: HeartbeatOptions,
  error: unknown,
): Promise<HeartbeatResult> {
  const { url, jobName, timeout = 5000 } = options;

  if (!url) {
    logger.warn(logger.fmt`[${jobName}] Heartbeat URL not configured - skipping failure notification`);
    return {
      success: false,
      message: 'Heartbeat URL not configured',
      timestamp: new Date().toISOString(),
    };
  }

  const failureUrl = `${url}/fail`;
  const errorMessage = error instanceof Error ? error.message : String(error);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(failureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        jobName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      logger.info(logger.fmt`[${jobName}] Failure heartbeat sent successfully`);
      return {
        success: true,
        message: 'Failure heartbeat sent successfully',
        timestamp: new Date().toISOString(),
      };
    } else {
      logger.error(logger.fmt`[${jobName}] Failure heartbeat failed with status ${response.status}: ${response.statusText}`);
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (heartbeatError) {
    // Log error but don't throw - heartbeat failures shouldn't break the main job
    const heartbeatErrorMessage =
      heartbeatError instanceof Error ? heartbeatError.message : 'Unknown error';
    logger.error(logger.fmt`[${jobName}] Failed to send failure heartbeat: ${heartbeatErrorMessage}`);

    return {
      success: false,
      message: heartbeatErrorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Wrapper function to execute a job with automatic heartbeat notifications
 *
 * Automatically sends success or failure heartbeats based on job outcome
 *
 * @param options - Heartbeat configuration
 * @param job - The async function to execute
 * @returns The result of the job
 *
 * @example
 * ```typescript
 * const result = await withHeartbeat({
 *   url: process.env.BETTERSTACK_HEARTBEAT_URL,
 *   jobName: 'Expert Payout Processing',
 * }, async () => {
 *   // Your job logic here
 *   return await processPayouts();
 * });
 * ```
 */
export async function withHeartbeat<T>(
  options: HeartbeatOptions,
  job: () => Promise<T>,
): Promise<T> {
  const { jobName } = options;

  try {
    logger.info(logger.fmt`[${jobName}] Starting job...`);
    const result = await job();

    // Job succeeded - send success heartbeat
    await sendHeartbeatSuccess(options);

    return result;
  } catch (error) {
    // Job failed - send failure heartbeat
    logger.error(logger.fmt`[${jobName}] Job failed`, { error });
    await sendHeartbeatFailure(options, error);

    // Re-throw the error so the caller knows the job failed
    throw error;
  }
}
