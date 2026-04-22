import * as Sentry from '@sentry/nextjs';
import { Redis } from '@upstash/redis';

const { logger } = Sentry;

/**
 * Redis client for distributed caching
 * Supports both Upstash Redis (production) and in-memory fallback (development)
 */
class RedisManager {
  private redis: Redis | null = null;
  private inMemoryCache: Map<string, { value: string; expiresAt: number }> = new Map();
  private isRedisAvailable = false;

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      // Allow disabling Redis via environment variable (useful for clearing cache)
      if (process.env.DISABLE_REDIS === 'true') {
        logger.warn('Redis disabled via DISABLE_REDIS=true, using in-memory cache');
        this.isRedisAvailable = false;
        return;
      }

      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (redisUrl && redisToken) {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
          automaticDeserialization: false,
        });
        this.isRedisAvailable = true;
        logger.info('Redis client initialized successfully');
      } else {
        logger.warn('Redis credentials not found, falling back to in-memory cache for development');
        this.isRedisAvailable = false;
      }
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error });
      this.isRedisAvailable = false;
    }
  }

  /**
   * Set a key-value pair with optional expiration in seconds
   */
  async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        if (expirationSeconds) {
          await this.redis.setex(key, expirationSeconds, value);
        } else {
          await this.redis.set(key, value);
        }
        return;
      } catch (error) {
        logger.error('Redis SET error', { error });
        // Fallback to in-memory cache
      }
    }

    // In-memory fallback
    const expiresAt = expirationSeconds
      ? Date.now() + expirationSeconds * 1000
      : Number.MAX_SAFE_INTEGER;

    this.inMemoryCache.set(key, { value, expiresAt });
    this.cleanupInMemoryCache();
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.get<string>(key);
        return result ?? null;
      } catch (error) {
        logger.error('Redis GET error', { error });
      }
    }

    // In-memory fallback
    this.cleanupInMemoryCache();
    const cached = this.inMemoryCache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (cached && cached.expiresAt <= Date.now()) {
      this.inMemoryCache.delete(key);
    }

    return null;
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    if (this.isRedisAvailable && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        logger.error('Redis DEL error', { error });
        // Fallback to in-memory cache
      }
    }

    // In-memory fallback
    this.inMemoryCache.delete(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        logger.error('Redis EXISTS error', { error });
        // Fallback to in-memory cache
      }
    }

    // In-memory fallback
    this.cleanupInMemoryCache();
    const cached = this.inMemoryCache.get(key);
    return cached ? cached.expiresAt > Date.now() : false;
  }

  /**
   * Atomically increment a numeric value
   */
  async incr(key: string, increment: number = 1): Promise<number> {
    if (this.isRedisAvailable && this.redis) {
      try {
        return await this.redis.incrby(key, increment);
      } catch (error) {
        logger.error('Redis INCR error', { error });
        // Fallback to non-atomic in-memory increment
      }
    }

    // In-memory fallback (non-atomic)
    const current = await this.get(key);
    const newValue = parseInt(current || '0') + increment;
    await this.set(key, newValue.toString());
    return newValue;
  }

  /**
   * Set expiration on an existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.expire(key, seconds);
        return result === 1;
      } catch (error) {
        logger.error('Redis EXPIRE error', { error });
        // Fallback to in-memory cache
      }
    }

    // In-memory fallback
    const cached = this.inMemoryCache.get(key);
    if (cached) {
      cached.expiresAt = Date.now() + seconds * 1000;
      return true;
    }
    return false;
  }

  /**
   * Get multiple values by keys
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const results = await this.redis.mget(...keys);
        return results as (string | null)[];
      } catch (error) {
        logger.error('Redis MGET error', { error });
        // Fallback to individual gets
      }
    }

    // In-memory fallback
    return Promise.all(keys.map((key) => this.get(key)));
  }

  /**
   * Set a key with expiration using Unix timestamp
   */
  async setWithTimestamp(key: string, value: string, expiresAt: number): Promise<void> {
    const secondsUntilExpiry = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    await this.set(key, value, secondsUntilExpiry);
  }

  /**
   * Clean up expired entries from in-memory cache
   */
  private cleanupInMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.inMemoryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      isRedisAvailable: this.isRedisAvailable,
      inMemoryCacheSize: this.inMemoryCache.size,
      cacheType: this.isRedisAvailable ? 'Redis' : 'In-Memory',
    };
  }

  /**
   * Health check for Redis connection with detailed metrics
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    mode: 'redis' | 'in-memory';
    message: string;
    error?: string;
  }> {
    const startTime = Date.now();

    if (!this.isRedisAvailable || !this.redis) {
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        mode: 'in-memory',
        message: 'Using in-memory cache fallback (Redis not configured)',
      };
    }

    try {
      // Use PING command to test Redis connectivity
      const response = await this.redis.ping();
      const responseTime = Date.now() - startTime;

      if (response === 'PONG') {
        return {
          status: 'healthy',
          responseTime,
          mode: 'redis',
          message: `Redis PING successful (${responseTime}ms)`,
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          mode: 'redis',
          message: 'Redis PING failed with unexpected response',
          error: `Expected 'PONG', got '${response}'`,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';

      return {
        status: 'unhealthy',
        responseTime,
        mode: 'redis',
        message: `Redis connection failed (${responseTime}ms)`,
        error: errorMessage,
      };
    }
  }
}

// Create a singleton instance
export const redisManager = new RedisManager();

/**
 * Idempotency cache constants and functions
 */
const IDEMPOTENCY_CACHE_PREFIX = 'idempotency:';
const IDEMPOTENCY_DEFAULT_TTL_SECONDS = 600; // 10 minutes

/**
 * Idempotency cache utility for API endpoints
 */
export const IdempotencyCache = {
  /**
   * Store an idempotency result
   */
  async set(
    key: string,
    result: { url: string },
    ttlSeconds: number = IDEMPOTENCY_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = IDEMPOTENCY_CACHE_PREFIX + key;
    const value = JSON.stringify(result);
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get an idempotency result
   */
  async get(key: string): Promise<{ url: string } | null> {
    const cacheKey = IDEMPOTENCY_CACHE_PREFIX + key;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached) as { url: string };
      } catch (error) {
        logger.error('Failed to parse cached idempotency result', { error });
        // Clean up corrupted cache entry
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Check if an idempotency key exists
   */
  async exists(key: string): Promise<boolean> {
    const cacheKey = IDEMPOTENCY_CACHE_PREFIX + key;
    return await redisManager.exists(cacheKey);
  },

  /**
   * Delete an idempotency key
   */
  async delete(key: string): Promise<void> {
    const cacheKey = IDEMPOTENCY_CACHE_PREFIX + key;
    await redisManager.del(cacheKey);
  },

  /**
   * Clean up expired entries (not needed for Redis as it handles TTL automatically)
   * This method is kept for compatibility and debugging
   */
  async cleanup(): Promise<void> {
    // Redis handles TTL automatically, so this is a no-op for Redis
    // For in-memory cache, cleanup happens automatically in get operations
    logger.debug('Idempotency cache cleanup requested (automatic with Redis)');
  },
};

/**
 * Form cache constants
 */
const FORM_CACHE_PREFIX = 'form:';
const FORM_DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * Form cache utility for frontend duplicate prevention
 */
export const FormCache = {
  /**
   * Store a form submission state
   */
  async set(
    key: string,
    formData: {
      eventId: string;
      guestEmail: string;
      startTime: string;
      status: 'processing' | 'completed' | 'failed';
      timestamp: number;
    },
    ttlSeconds: number = FORM_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = FORM_CACHE_PREFIX + key;

    // Validate formData structure before stringifying
    if (!formData || typeof formData !== 'object') {
      logger.error('Invalid formData provided to FormCache.set', { formData });
      return;
    }

    // Ensure all required fields are present
    const { eventId, guestEmail, startTime, status, timestamp } = formData;
    if (!eventId || !guestEmail || !startTime || !status || !timestamp) {
      logger.error('Missing required fields in formData', { formData });
      return;
    }

    try {
      const value = JSON.stringify(formData);
      await redisManager.set(cacheKey, value, ttlSeconds);
    } catch (error) {
      logger.error('Failed to stringify formData for FormCache', { error, formData });
    }
  },

  /**
   * Get a form submission state
   */
  async get(key: string): Promise<{
    eventId: string;
    guestEmail: string;
    startTime: string;
    status: 'processing' | 'completed' | 'failed';
    timestamp: number;
  } | null> {
    const cacheKey = FORM_CACHE_PREFIX + key;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        // Check if cached value is already an object (should not happen)
        if (typeof cached === 'object' && cached !== null) {
          logger.warn('Cached value is already an object, converting to JSON', {
            cacheKey,
            cachedType: typeof cached,
          });

          const cachedObj = cached as Record<string, unknown>; // Use Record for object inspection

          // If it looks like a valid FormCache object, return it directly
          if (
            cachedObj.eventId &&
            cachedObj.guestEmail &&
            cachedObj.startTime &&
            cachedObj.status
          ) {
            return cachedObj as {
              eventId: string;
              guestEmail: string;
              startTime: string;
              status: 'processing' | 'completed' | 'failed';
              timestamp: number;
            };
          }

          // Otherwise, try to extract from Redis cache wrapper
          if (cachedObj.value && typeof cachedObj.value === 'string') {
            logger.warn('Found wrapped cache value, extracting', { value: cachedObj.value });
            return JSON.parse(cachedObj.value);
          }

          // If it's some other object structure, clean it up
          logger.error('Unexpected cached object structure, cleaning up', { cached });
          await redisManager.del(cacheKey);
          return null;
        }

        // Ensure cached value is a string
        if (typeof cached !== 'string') {
          logger.error('Cached value is not a string', { cachedType: typeof cached, cached });
          await redisManager.del(cacheKey);
          return null;
        }

        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached form data', { error, cached });
        // Clean up corrupted cache entry
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Check if a form submission is in progress or very recently completed
   */
  async isProcessing(key: string): Promise<boolean> {
    const cached = await FormCache.get(key);

    if (!cached) return false;

    // Block if actively processing
    if (cached.status === 'processing') {
      return true;
    }

    // Block if VERY recently completed (within last 3 seconds) to prevent double submissions
    // This prevents the race condition where the first request completes between button clicks
    if (cached.status === 'completed') {
      const timeSinceCompletion = Date.now() - cached.timestamp;
      const veryRecentlyCompleted = timeSinceCompletion < 3000; // Only 3 seconds

      if (veryRecentlyCompleted) {
        logger.debug('Form submission very recently completed, blocking potential duplicate', {
          key,
          timeSinceCompletion,
          status: cached.status,
        });
        return true;
      }
    }

    return false;
  },

  /**
   * Mark form submission as completed
   */
  async markCompleted(key: string): Promise<void> {
    try {
      const cached = await FormCache.get(key);
      if (cached) {
        cached.status = 'completed';
        cached.timestamp = Date.now();
        await FormCache.set(key, cached);
      } else {
        logger.warn('No cached data found to mark as completed for key', { key });
      }
    } catch (error) {
      logger.error('Error marking FormCache as completed', { error, key });
    }
  },

  /**
   * Mark form submission as failed
   */
  async markFailed(key: string): Promise<void> {
    try {
      const cached = await FormCache.get(key);
      if (cached) {
        cached.status = 'failed';
        cached.timestamp = Date.now();
        await FormCache.set(key, cached);
      } else {
        logger.warn('No cached data found to mark as failed for key', { key });
      }
    } catch (error) {
      logger.error('Error marking FormCache as failed', { error, key });
    }
  },

  /**
   * Delete a form submission cache entry
   */
  async delete(key: string): Promise<void> {
    const cacheKey = FORM_CACHE_PREFIX + key;
    await redisManager.del(cacheKey);
  },

  /**
   * Generate a unique key for form submission
   */
  generateKey(eventId: string, guestEmail: string, startTime: string): string {
    return `${eventId}-${guestEmail}-${startTime}`.replace(/[^a-zA-Z0-9-_]/g, '_');
  },
};

/**
 * Types for cached data structures
 */
interface CachedCustomerData {
  stripeCustomerId: string;
  email: string;
  userId?: string;
  name?: string | null;
  subscriptions?: string[];
  defaultPaymentMethod?: string | null;
  created: number;
  updatedAt: number;
}

interface CachedSubscriptionData {
  id: string;
  customerId: string;
  status: string;
  priceId: string;
  productId: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  created: number;
  updatedAt: number;
}

/**
 * Customer cache constants
 */
const CUSTOMER_CACHE_PREFIX = 'customer:';
const CUSTOMER_USER_PREFIX = 'user:';
const CUSTOMER_EMAIL_PREFIX = 'email:';
const CUSTOMER_SUBSCRIPTION_PREFIX = 'subscription:';
const CUSTOMER_DEFAULT_TTL_SECONDS = 86400; // 24 hours

/**
 * Customer cache utility for Stripe customer/session data
 * Consolidates the existing KV store functionality from lib/stripe.ts
 */
export const CustomerCache = {
  /**
   * Store customer data by Stripe customer ID
   */
  async setCustomer(
    customerId: string,
    customerData: CachedCustomerData,
    ttlSeconds: number = CUSTOMER_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = CUSTOMER_CACHE_PREFIX + customerId;
    const value = JSON.stringify(customerData);
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get customer data by Stripe customer ID
   */
  async getCustomer(customerId: string): Promise<CachedCustomerData | null> {
    const cacheKey = CUSTOMER_CACHE_PREFIX + customerId;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached) as CachedCustomerData;
      } catch (error) {
        logger.error('Failed to parse cached customer data', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Store user ID to customer ID mapping
   */
  async setUserMapping(
    userId: string,
    customerId: string,
    ttlSeconds: number = CUSTOMER_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = CUSTOMER_USER_PREFIX + userId;
    await redisManager.set(cacheKey, customerId, ttlSeconds);
  },

  /**
   * Get customer ID by user ID
   */
  async getCustomerByUserId(userId: string): Promise<string | null> {
    const cacheKey = CUSTOMER_USER_PREFIX + userId;
    return await redisManager.get(cacheKey);
  },

  /**
   * Store email to customer ID mapping
   */
  async setEmailMapping(
    email: string,
    customerId: string,
    ttlSeconds: number = CUSTOMER_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = CUSTOMER_EMAIL_PREFIX + email;
    await redisManager.set(cacheKey, customerId, ttlSeconds);
  },

  /**
   * Get customer ID by email
   */
  async getCustomerByEmail(email: string): Promise<string | null> {
    const cacheKey = CUSTOMER_EMAIL_PREFIX + email;
    return await redisManager.get(cacheKey);
  },

  /**
   * Store subscription data
   */
  async setSubscription(
    subscriptionId: string,
    subscriptionData: CachedSubscriptionData,
    ttlSeconds: number = CUSTOMER_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = CUSTOMER_SUBSCRIPTION_PREFIX + subscriptionId;
    const value = JSON.stringify(subscriptionData);
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get subscription data
   */
  async getSubscription(subscriptionId: string): Promise<CachedSubscriptionData | null> {
    const cacheKey = CUSTOMER_SUBSCRIPTION_PREFIX + subscriptionId;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached) as CachedSubscriptionData;
      } catch (error) {
        logger.error('Failed to parse cached subscription data', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Delete customer and all related mappings
   */
  async deleteCustomer(customerId: string, email?: string, userId?: string): Promise<void> {
    const deletePromises = [redisManager.del(CUSTOMER_CACHE_PREFIX + customerId)];

    if (email) {
      deletePromises.push(redisManager.del(CUSTOMER_EMAIL_PREFIX + email));
    }

    if (userId) {
      deletePromises.push(redisManager.del(CUSTOMER_USER_PREFIX + userId));
    }

    await Promise.all(deletePromises);
  },

  /**
   * Health check for customer cache
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const testKey = CUSTOMER_CACHE_PREFIX + 'health-check';
      const testData = { test: true, timestamp: Date.now() };

      await redisManager.set(testKey, JSON.stringify(testData), 10);
      const retrieved = await redisManager.get(testKey);
      await redisManager.del(testKey);

      if (retrieved && JSON.parse(retrieved).test === true) {
        return { status: 'healthy', message: 'Customer cache is working properly' };
      } else {
        return { status: 'unhealthy', message: 'Customer cache test failed' };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Customer cache error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export default redisManager;

/**
 * Notification queue interfaces
 */
export interface QueuedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high';
  queuedAt: number;
  scheduledFor: number;
}

export interface NotificationBatchData {
  notifications: Array<{ userId: string; notification: QueuedNotification }>;
  createdAt: number;
  status: string;
}

/**
 * Notification queue cache constants
 */
const NOTIFICATION_QUEUE_CACHE_PREFIX = 'notification_queue:';
const NOTIFICATION_BATCH_PREFIX = 'notification_batch:';
const NOTIFICATION_DEFAULT_TTL_SECONDS = 3600; // 1 hour

/**
 * Notification queue cache for managing notification delivery and batching
 */
export const NotificationQueueCache = {
  /**
   * Queue a notification for batch processing
   */
  async queueNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
      priority?: 'low' | 'normal' | 'high';
      scheduledFor?: Date;
    },
  ): Promise<void> {
    const cacheKey = NOTIFICATION_QUEUE_CACHE_PREFIX + userId;
    const now = Date.now();

    const queueItem: QueuedNotification = {
      id: `notif_${now}_${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      queuedAt: now,
      scheduledFor: notification.scheduledFor?.getTime() || now,
    };

    try {
      // Get current queue
      const cached = await redisManager.get(cacheKey);
      let queue: QueuedNotification[] = [];

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Validate that parsed data is an array
          if (Array.isArray(parsed)) {
            queue = parsed;
          } else {
            logger.warn('Invalid notification queue cache data, resetting', {
              cacheKey,
              parsed,
            });
            // Reset corrupted cache entry
            await redisManager.del(cacheKey);
            queue = [];
          }
        } catch (parseError) {
          logger.error('Failed to parse notification queue cache data', {
            cacheKey,
            error: parseError,
          });
          // Reset corrupted cache entry
          await redisManager.del(cacheKey);
          queue = [];
        }
      }

      // Add new notification
      queue.push(queueItem);

      // Sort by priority and scheduled time
      queue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const aPriority = priorityOrder[a.priority || 'normal'];
        const bPriority = priorityOrder[b.priority || 'normal'];

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        return a.scheduledFor - b.scheduledFor; // Earlier time first
      });

      // Store updated queue
      const value = JSON.stringify(queue);
      await redisManager.set(cacheKey, value, NOTIFICATION_DEFAULT_TTL_SECONDS);
    } catch (error) {
      logger.error('Failed to queue notification', { error });
      throw error;
    }
  },

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string, limit: number = 10): Promise<QueuedNotification[]> {
    const cacheKey = NOTIFICATION_QUEUE_CACHE_PREFIX + userId;
    const now = Date.now();

    try {
      const cached = await redisManager.get(cacheKey);
      if (!cached) return [];

      const parsed = JSON.parse(cached);
      // Validate that parsed data is an array
      if (!Array.isArray(parsed)) {
        logger.warn('Invalid notification queue cache data, resetting', {
          cacheKey,
          parsed,
        });
        // Reset corrupted cache entry
        await redisManager.del(cacheKey);
        return [];
      }

      const queue: QueuedNotification[] = parsed;

      // Filter notifications that are ready to be sent
      return queue.filter((item) => item.scheduledFor <= now).slice(0, limit);
    } catch (error) {
      logger.error('Failed to get pending notifications', { error });
      return [];
    }
  },

  /**
   * Remove processed notifications from queue
   */
  async removeProcessedNotifications(userId: string, notificationIds: string[]): Promise<void> {
    const cacheKey = NOTIFICATION_QUEUE_CACHE_PREFIX + userId;

    try {
      const cached = await redisManager.get(cacheKey);
      if (!cached) return;

      const parsed = JSON.parse(cached);
      // Validate that parsed data is an array
      if (!Array.isArray(parsed)) {
        logger.warn('Invalid notification queue cache data, resetting', {
          cacheKey,
          parsed,
        });
        // Reset corrupted cache entry
        await redisManager.del(cacheKey);
        return;
      }

      let queue: QueuedNotification[] = parsed;

      // Remove processed notifications
      queue = queue.filter((item) => !notificationIds.includes(item.id));

      if (queue.length === 0) {
        await redisManager.del(cacheKey);
      } else {
        const value = JSON.stringify(queue);
        await redisManager.set(cacheKey, value, NOTIFICATION_DEFAULT_TTL_SECONDS);
      }
    } catch (error) {
      logger.error('Failed to remove processed notifications', { error });
    }
  },

  /**
   * Create a batch key for grouping notifications
   */
  async createBatch(
    batchId: string,
    notifications: Array<{ userId: string; notification: QueuedNotification }>,
    ttlSeconds: number = 1800, // 30 minutes
  ): Promise<void> {
    const cacheKey = NOTIFICATION_BATCH_PREFIX + batchId;
    const batchData: NotificationBatchData = {
      notifications,
      createdAt: Date.now(),
      status: 'pending',
    };
    const value = JSON.stringify(batchData);
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get batch for processing
   */
  async getBatch(batchId: string): Promise<NotificationBatchData | null> {
    const cacheKey = NOTIFICATION_BATCH_PREFIX + batchId;
    const cached = await redisManager.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  },
};

/**
 * Analytics cache constants
 */
const ANALYTICS_CACHE_PREFIX = 'analytics:';
const ANALYTICS_METRICS_PREFIX = 'metrics:';
const ANALYTICS_DEFAULT_TTL_SECONDS = 1800; // 30 minutes

/**
 * Analytics cache for metrics and performance data
 */
export const AnalyticsCache = {
  /**
   * Cache analytics data
   */
  async cacheAnalytics(
    key: string,
    data: Record<string, unknown>,
    ttlSeconds: number = ANALYTICS_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = ANALYTICS_CACHE_PREFIX + key;
    const value = JSON.stringify({
      data,
      cachedAt: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get cached analytics data
   */
  async getAnalytics(key: string): Promise<{
    data: Record<string, unknown>;
    cachedAt: number;
  } | null> {
    const cacheKey = ANALYTICS_CACHE_PREFIX + key;
    const cached = await redisManager.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  },

  /**
   * Increment a metric counter atomically
   */
  async incrementMetric(
    metricKey: string,
    increment: number = 1,
    windowSeconds: number = 3600, // 1 hour
  ): Promise<number> {
    const cacheKey = ANALYTICS_METRICS_PREFIX + metricKey;

    try {
      // Use atomic increment operation
      const newValue = await redisManager.incr(cacheKey, increment);

      // Set TTL if this was the first increment
      if (newValue === increment) {
        await redisManager.expire(cacheKey, windowSeconds);
      }

      return newValue;
    } catch (error) {
      logger.error('Failed to increment metric', { error });
      return increment; // Return the increment as fallback
    }
  },

  /**
   * Get metric value
   */
  async getMetric(metricKey: string): Promise<number> {
    const cacheKey = ANALYTICS_METRICS_PREFIX + metricKey;
    const cached = await redisManager.get(cacheKey);
    return cached ? parseInt(cached) : 0;
  },

  /**
   * Cache PostHog analytics data
   */
  async cachePostHogData(
    userId: string,
    eventData: Record<string, unknown>,
    ttlSeconds: number = 86400, // 24 hours
  ): Promise<void> {
    const cacheKey = `posthog:user:${userId}:${Date.now()}`;
    const value = JSON.stringify(eventData);
    await redisManager.set(cacheKey, value, ttlSeconds);
  },
};

/**
 * Session cache constants
 */
const SESSION_CACHE_PREFIX = 'session:';
const SESSION_DEFAULT_TTL_SECONDS = 86400; // 24 hours

/**
 * Session enhancement cache for storing additional session data
 */
export const SessionCache = {
  /**
   * Store enhanced session data
   */
  async setSessionData(
    sessionId: string,
    data: {
      userId: string;
      roles: string[];
      lastActivity: number;
      deviceInfo?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
    },
    ttlSeconds: number = SESSION_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    const value = JSON.stringify({
      ...data,
      updatedAt: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get enhanced session data
   */
  async getSessionData(sessionId: string): Promise<{
    userId: string;
    roles: string[];
    lastActivity: number;
    deviceInfo?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    updatedAt: number;
  } | null> {
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    const cached = await redisManager.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  },

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string, lastActivity: number = Date.now()): Promise<void> {
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      const sessionData = JSON.parse(cached);
      sessionData.lastActivity = lastActivity;
      sessionData.updatedAt = Date.now();

      const value = JSON.stringify(sessionData);
      await redisManager.set(cacheKey, value, SESSION_DEFAULT_TTL_SECONDS);
    }
  },

  /**
   * Remove session data
   */
  async removeSessionData(sessionId: string): Promise<void> {
    const cacheKey = SESSION_CACHE_PREFIX + sessionId;
    await redisManager.del(cacheKey);
  },
};

/**
 * Database cache constants
 */
const DATABASE_CACHE_PREFIX = 'db:';
const DATABASE_DEFAULT_TTL_SECONDS = 1800; // 30 minutes

/**
 * Database query cache for frequently accessed data
 */
export const DatabaseCache = {
  /**
   * Cache user data
   */
  async setUser(
    userId: string,
    userData: Record<string, unknown>,
    ttlSeconds: number = DATABASE_DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const cacheKey = DATABASE_CACHE_PREFIX + `user:${userId}`;
    const value = JSON.stringify({
      ...userData,
      cachedAt: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get cached user data
   */
  async getUser(userId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = DATABASE_CACHE_PREFIX + `user:${userId}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached user data', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Cache expert profile with events and availability
   */
  async setExpertProfile(
    userId: string,
    profileData: Record<string, unknown>,
    ttlSeconds: number = 600, // 10 minutes for profiles (more dynamic data)
  ): Promise<void> {
    const cacheKey = DATABASE_CACHE_PREFIX + `profile:${userId}`;
    const value = JSON.stringify({
      ...profileData,
      cachedAt: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get cached expert profile
   */
  async getExpertProfile(userId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = DATABASE_CACHE_PREFIX + `profile:${userId}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached profile data', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Cache dashboard analytics for customers/experts
   */
  async setDashboardData(
    userId: string,
    dashboardData: Record<string, unknown>,
    ttlSeconds: number = 900, // 15 minutes
  ): Promise<void> {
    const cacheKey = DATABASE_CACHE_PREFIX + `dashboard:${userId}`;
    const value = JSON.stringify({
      ...dashboardData,
      cachedAt: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get cached dashboard data
   */
  async getDashboardData(userId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = DATABASE_CACHE_PREFIX + `dashboard:${userId}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached dashboard data', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Invalidate all cached data for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    const keysToDelete = [
      DATABASE_CACHE_PREFIX + `user:${userId}`,
      DATABASE_CACHE_PREFIX + `profile:${userId}`,
      DATABASE_CACHE_PREFIX + `dashboard:${userId}`,
    ];

    await Promise.all(keysToDelete.map((key) => redisManager.del(key)));
  },

  /**
   * Health check for database cache
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      const testKey = DATABASE_CACHE_PREFIX + 'health-check';
      const testData = { test: true, timestamp: Date.now() };

      await redisManager.set(testKey, JSON.stringify(testData), 10);
      const retrieved = await redisManager.get(testKey);
      await redisManager.del(testKey);

      if (retrieved && JSON.parse(retrieved).test === true) {
        return { status: 'healthy', message: 'Database cache is working properly' };
      } else {
        return { status: 'unhealthy', message: 'Database cache test failed' };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database cache error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

/**
 * Temporary data cache constants
 */
const TEMP_DATA_CACHE_PREFIX = 'temp:';

/**
 * Temporary data storage for multi-step processes
 */
export const TempDataCache = {
  /**
   * Store setup progress for expert onboarding
   */
  async storeSetupProgress(
    userId: string,
    step: string,
    data: Record<string, unknown>,
    ttlSeconds: number = 3600, // 1 hour
  ): Promise<void> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `setup:${userId}:${step}`;
    const value = JSON.stringify({
      ...data,
      step,
      userId,
      timestamp: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get setup progress
   */
  async getSetupProgress(userId: string, step: string): Promise<Record<string, unknown> | null> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `setup:${userId}:${step}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached setup progress', { error });
        await redisManager.del(cacheKey);
      }
    }

    return null;
  },

  /**
   * Store OAuth state data
   */
  async storeOAuthState(
    state: string,
    data: Record<string, unknown>,
    ttlSeconds: number = 900, // 15 minutes
  ): Promise<void> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `oauth:${state}`;
    const value = JSON.stringify({
      ...data,
      state,
      timestamp: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get and consume OAuth state (one-time use)
   */
  async getOAuthState(state: string): Promise<Record<string, unknown> | null> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `oauth:${state}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      // Delete immediately after retrieval (one-time use)
      await redisManager.del(cacheKey);
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached OAuth state', { error });
      }
    }

    return null;
  },

  /**
   * Store verification tokens
   */
  async storeVerificationToken(
    token: string,
    data: Record<string, unknown>,
    ttlSeconds: number = 3600, // 1 hour
  ): Promise<void> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `verification:${token}`;
    const value = JSON.stringify({
      ...data,
      token,
      timestamp: Date.now(),
    });
    await redisManager.set(cacheKey, value, ttlSeconds);
  },

  /**
   * Get and consume verification token (one-time use)
   */
  async getVerificationToken(token: string): Promise<Record<string, unknown> | null> {
    const cacheKey = TEMP_DATA_CACHE_PREFIX + `verification:${token}`;
    const cached = await redisManager.get(cacheKey);

    if (cached) {
      // Delete immediately after retrieval (one-time use)
      await redisManager.del(cacheKey);
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached verification token', { error });
      }
    }

    return null;
  },
};
