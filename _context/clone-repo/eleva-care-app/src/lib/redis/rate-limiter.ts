/**
 * Rate Limiting via @upstash/ratelimit
 *
 * Provides atomic, distributed rate limiting using Upstash Redis
 * with sliding window algorithm. Replaces the old custom RateLimitCache
 * that used non-atomic JSON arrays.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import * as Sentry from '@sentry/nextjs';

const { logger } = Sentry;

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

const limiterCache = new Map<string, Ratelimit>();

/**
 * Creates (or reuses) an atomic rate limiter backed by Upstash Redis.
 *
 * Uses sliding-window algorithm by default so limits degrade
 * smoothly instead of resetting at fixed boundaries.
 *
 * @param maxRequests  Maximum number of requests allowed in the window
 * @param windowSec    Window duration in seconds (e.g. 900 = 15 min)
 * @param prefix       Key prefix to namespace this limiter
 */
function getRateLimiter(maxRequests: number, windowSec: number, prefix: string): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const cacheKey = `${prefix}:${maxRequests}:${windowSec}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
      prefix,
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * Atomically check and record a rate-limit attempt.
 *
 * Unlike the old two-step check-then-record approach, this is a single
 * atomic operation — no race conditions.
 *
 * @param identifier  Unique key for the entity being limited (user ID, IP, etc.)
 * @param maxAttempts Maximum requests in the window
 * @param windowSeconds Window size in seconds
 * @param prefix      Optional Redis key prefix (defaults to `@upstash/ratelimit`)
 */
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number,
  prefix = '@upstash/ratelimit',
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(maxAttempts, windowSeconds, prefix);

  if (!limiter) {
    // Redis not configured — fail open
    return { allowed: true, remaining: maxAttempts - 1, resetTime: Date.now() + windowSeconds * 1000, totalHits: 0 };
  }

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return {
      allowed: success,
      remaining,
      resetTime: reset,
      totalHits: limit - remaining,
    };
  } catch (error) {
    logger.error('Rate limit check failed', { error });
    // Fail open on errors
    return { allowed: true, remaining: maxAttempts - 1, resetTime: Date.now() + windowSeconds * 1000, totalHits: 0 };
  }
}

/**
 * Reset the rate limit counter for a given identifier.
 */
export async function resetRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number,
  prefix = '@upstash/ratelimit',
): Promise<void> {
  const limiter = getRateLimiter(maxAttempts, windowSeconds, prefix);
  if (!limiter) return;

  try {
    await limiter.resetUsedTokens(identifier);
  } catch (error) {
    logger.error('Failed to reset rate limit', { error });
    Sentry.captureException(error);
  }
}
