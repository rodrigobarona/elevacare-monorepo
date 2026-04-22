import { neon } from '@neondatabase/serverless';
import { upstashCache } from 'drizzle-orm/cache/upstash';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

/**
 * Validates and retrieves the main database URL.
 * In production, this MUST be set to a valid Neon database URL.
 * In development/test, a placeholder is allowed for build-time operations.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  // During build phase, allow placeholder (we don't actually connect to DB during build)
  if (isBuildPhase) {
    return url || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  }

  // In production runtime, the database URL MUST be configured
  if (nodeEnv === 'production') {
    if (!url) {
      throw new Error(
        'FATAL: DATABASE_URL is required in production environment. ' +
          'This is the main database for all core application data (events, schedules, profiles, etc.). ' +
          'Please configure DATABASE_URL in your environment variables.',
      );
    }
    if (url.includes('placeholder') || url.includes('localhost')) {
      throw new Error(
        'FATAL: DATABASE_URL contains a placeholder or localhost value in production. ' +
          'This is not allowed. Please configure a valid Neon database URL.',
      );
    }
  }

  // In non-production, allow placeholder for build/test environments
  return url || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
}

/**
 * Creates the Drizzle query cache backed by Upstash Redis.
 * Uses explicit strategy (global: false) -- only queries with `.$withCache()` are cached.
 * Skipped during build phase or when Redis credentials are missing.
 */
function getCache() {
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (isBuildPhase || !url || !token) {
    return undefined;
  }

  return upstashCache({
    url,
    token,
    global: false,
    config: { ex: 60 },
  });
}

const databaseUrl = getDatabaseUrl();
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema, cache: getCache() });

/**
 * Invalidate Drizzle query cache by tags.
 * Safe to call when cache is not configured (e.g. during build).
 */
export async function invalidateCache(tags: string[]): Promise<void> {
  try {
    const cache = (db as { $cache?: { invalidate: (opts: { tags: string | string[] }) => Promise<void> } }).$cache;
    if (cache) {
      await cache.invalidate({ tags });
    }
  } catch {
    // Non-critical - cache may not be configured
  }
}
