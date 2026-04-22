import { redisManager } from '@/lib/redis/manager';
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

/**
 * Error boundary for Redis operations
 * Provides consistent error handling and logging for Redis operations
 */
export class RedisErrorBoundary {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 100;

  /**
   * Execute a Redis operation with retries and error handling
   */
  static async execute<T>(
    operation: () => Promise<T>,
    {
      key,
      operationName,
      retries = this.MAX_RETRIES,
      retryDelay = this.RETRY_DELAY_MS,
      fallback,
    }: {
      key: string;
      operationName: string;
      retries?: number;
      retryDelay?: number;
      fallback?: () => Promise<T>;
    },
  ): Promise<T | null> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < retries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Log the error with attempt count
        logger.error(
          logger.fmt`Redis ${operationName} error (attempt ${attempt}/${retries}) for key "${key}"`,
          { error },
        );

        // If we have more retries, wait before trying again
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    // All retries failed, try fallback if provided
    if (fallback) {
      try {
        logger.info(logger.fmt`Using fallback for failed Redis ${operationName} on key "${key}"`);
        return await fallback();
      } catch (fallbackError) {
        logger.error(
          logger.fmt`Fallback also failed for Redis ${operationName} on key "${key}"`,
          { error: fallbackError },
        );
      }
    }

    // Log the final failure
    logger.error(
      logger.fmt`Redis ${operationName} failed after ${retries} attempts for key "${key}"`,
      { lastError },
    );

    return null;
  }

  /**
   * Get a value from Redis with error handling
   */
  static async get(key: string): Promise<string | null> {
    return this.execute(() => redisManager.get(key), {
      key,
      operationName: 'GET',
    });
  }

  /**
   * Set a value in Redis with error handling
   */
  static async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    await this.execute(() => redisManager.set(key, value, expirationSeconds), {
      key,
      operationName: 'SET',
    });
  }

  /**
   * Delete a key from Redis with error handling
   */
  static async del(key: string): Promise<void> {
    await this.execute(() => redisManager.del(key), {
      key,
      operationName: 'DEL',
    });
  }

  /**
   * Check if a key exists in Redis with error handling
   */
  static async exists(key: string): Promise<boolean> {
    const result = await this.execute(() => redisManager.exists(key), {
      key,
      operationName: 'EXISTS',
    });
    return result ?? false;
  }

  /**
   * Get multiple values from Redis with error handling
   */
  static async mget(keys: string[]): Promise<(string | null)[]> {
    const result = await this.execute(() => redisManager.mget(keys), {
      key: keys.join(','),
      operationName: 'MGET',
    });
    return result ?? keys.map(() => null);
  }

  /**
   * Increment a value in Redis with error handling
   */
  static async incr(key: string, increment: number = 1): Promise<number> {
    const result = await this.execute(() => redisManager.incr(key, increment), {
      key,
      operationName: 'INCR',
    });
    return result ?? increment;
  }

  /**
   * Set expiration on a key with error handling
   */
  static async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.execute(() => redisManager.expire(key, seconds), {
      key,
      operationName: 'EXPIRE',
    });
    return result ?? false;
  }
}
