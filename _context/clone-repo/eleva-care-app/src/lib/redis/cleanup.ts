/**
 * Payment Rate Limit Cache Cleanup Utility
 *
 * This module provides functionality to clean up corrupted payment rate limit cache entries
 * that were created with the old key format causing "filter is not a function" errors.
 */
import { ENV_CONFIG, ENV_VALIDATORS } from '@/config/env';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

export interface CleanupStats {
  scannedKeys: number;
  corruptedKeys: number;
  cleanedKeys: number;
  errors: number;
  skippedKeys: number;
}

/**
 * Cleans up corrupted payment rate limit cache entries
 *
 * @returns Stats about the cleanup operation
 *
 * @example
 * ```typescript
 * const stats = await cleanupPaymentRateLimitCache();
 * console.log(`Cleaned ${stats.cleanedKeys} corrupted entries`);
 * ```
 */
export async function cleanupPaymentRateLimitCache(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    scannedKeys: 0,
    corruptedKeys: 0,
    cleanedKeys: 0,
    errors: 0,
    skippedKeys: 0,
  };

  try {
    logger.info('Scanning for payment rate limit cache entries');

    // Validate Redis environment
    const redisValidation = ENV_VALIDATORS.redis();
    if (!redisValidation.isValid) {
      logger.error('Redis environment validation failed', {
        message: redisValidation.message,
        missingVars: redisValidation.missingVars,
      });
      throw new Error(`Redis validation failed: ${redisValidation.message}`);
    }

    // Initialize Redis client using validated environment config
    const redis = new Redis({
      url: ENV_CONFIG.UPSTASH_REDIS_REST_URL,
      token: ENV_CONFIG.UPSTASH_REDIS_REST_TOKEN,
    });

    // Get all payment rate limit keys
    const paymentKeys = await redis.keys('rate_limit:payment:*');
    stats.scannedKeys = paymentKeys.length;

    logger.info(logger.fmt`Found ${paymentKeys.length} payment rate limit keys to check`);

    if (paymentKeys.length === 0) {
      logger.info('No payment rate limit keys found');
      return stats;
    }

    // Process keys in batches
    const batchSize = 50;
    for (let i = 0; i < paymentKeys.length; i += batchSize) {
      const batch = paymentKeys.slice(i, i + batchSize);

      logger.debug(
        logger.fmt`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(paymentKeys.length / batchSize)}`,
      );

      for (const key of batch) {
        try {
          const value = await redis.get(key);

          if (value === null) {
            logger.debug(logger.fmt`Skipping null key: ${key}`);
            stats.skippedKeys++;
            continue;
          }

          // Check if it's corrupted (single number instead of array)
          let isCorrupted = false;

          try {
            const parsed = JSON.parse(value as string);

            // Should be an array of timestamps
            if (!Array.isArray(parsed)) {
              logger.debug(logger.fmt`Corrupted (not array): ${key}`, { value });
              isCorrupted = true;
            } else if (!parsed.every((item) => typeof item === 'number')) {
              logger.debug(logger.fmt`Corrupted (invalid array items): ${key}`, {
                parsed: JSON.stringify(parsed),
              });
              isCorrupted = true;
            } else {
              // Valid format
              logger.debug(logger.fmt`Valid: ${key}`, { entries: parsed.length });
            }
          } catch (parseError) {
            // Check if it's a plain number (corrupted format)
            if (!isNaN(Number(value))) {
              logger.debug(logger.fmt`Corrupted (plain number): ${key}`, { value });
              isCorrupted = true;
            } else {
              logger.debug(logger.fmt`Corrupted (invalid JSON): ${key}`, {
                value,
                error: parseError instanceof Error ? parseError.message : parseError,
              });
              isCorrupted = true;
            }
          }

          if (isCorrupted) {
            stats.corruptedKeys++;

            // Delete the corrupted entry
            await redis.del(key);
            stats.cleanedKeys++;
            logger.info(logger.fmt`Deleted corrupted key: ${key}`);
          }
        } catch (error) {
          logger.error(logger.fmt`Error processing key ${key}`, { error });
          stats.errors++;
        }
      }

      // Small delay between batches to avoid overwhelming Redis
      if (i + batchSize < paymentKeys.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    logger.info('Cleanup Summary', {
      scannedKeys: stats.scannedKeys,
      corruptedKeys: stats.corruptedKeys,
      cleanedKeys: stats.cleanedKeys,
      skippedKeys: stats.skippedKeys,
      errors: stats.errors,
    });

    if (stats.cleanedKeys > 0) {
      logger.info(
        logger.fmt`Successfully cleaned up ${stats.cleanedKeys} corrupted payment rate limit entries`,
      );
    } else {
      logger.info('No corrupted entries found - cache is healthy');
    }

    return stats;
  } catch (error) {
    logger.error('Cleanup script failed', { error });
    Sentry.captureException(error);
    throw error;
  }
}
