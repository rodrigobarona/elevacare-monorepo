# Clerk User Cache Implementation

## Overview

The Clerk user cache provides a robust, production-ready caching layer for Clerk user data using a hybrid approach:

- **React.cache** for request-level memoization (prevents duplicate calls within the same render)
- **Upstash Redis** for distributed caching (persists across requests and serverless functions)

## Architecture

### Why This Approach?

1. **Stability**: Uses stable APIs (`React.cache` + Redis) instead of `unstable_cache`
2. **Performance**: Two-tier caching reduces Clerk API calls significantly
3. **Scalability**: Redis-backed distributed cache works across serverless functions
4. **Batching**: Handles Clerk API's 500-user limit automatically

### Cache Flow

```
Request → React.cache (in-memory) → Redis → Clerk API
                ↓                      ↓         ↓
            Cache HIT              Cache HIT   Cache MISS
                ↓                      ↓         ↓
            Return data           Return data  Fetch & Cache
```

## API Reference

### Core Functions

#### `getCachedUserByUsername(username: string): Promise<User | null>`

Fetches a Clerk user by username with caching.

```typescript
import { getCachedUserByUsername } from '@/lib/cache/clerk-cache';

const user = await getCachedUserByUsername('johndoe');
```

**Cache Strategy:**

- TTL: 5 minutes (300 seconds)
- Cache Key: `clerk:username:{username}`
- Request-level memoization via `React.cache`

#### `getCachedUserById(userId: string): Promise<User | null>`

Fetches a Clerk user by ID with caching.

```typescript
import { getCachedUserById } from '@/lib/cache/clerk-cache';

const user = await getCachedUserById('user_123');
```

**Cache Strategy:**

- TTL: 5 minutes (300 seconds)
- Cache Key: `clerk:id:{userId}`
- Request-level memoization via `React.cache`

#### `getCachedUsersByIds(userIds: string[]): Promise<User[]>`

Fetches multiple Clerk users by IDs with caching and automatic batching.

```typescript
import { getCachedUsersByIds } from '@/lib/cache/clerk-cache';

const users = await getCachedUsersByIds(['user_1', 'user_2', 'user_3']);
```

**Features:**

- Automatic batching for Clerk API's 500-user limit
- Handles empty input gracefully
- Continues processing if one batch fails
- Caches only small batches (≤10 users) to avoid huge cache keys

**Cache Strategy:**

- TTL: 5 minutes (300 seconds)
- Cache Key: `clerk:ids:{sorted_user_ids}` (only for ≤10 users)
- Request-level memoization via `React.cache`

**Batching Logic:**

```typescript
// Example: 750 users → 2 batches (500 + 250)
const userIds = Array.from({ length: 750 }, (_, i) => `user_${i}`);
const users = await getCachedUsersByIds(userIds);
// Makes 2 API calls automatically
```

## Cache Configuration

### TTL (Time To Live)

- Default: **5 minutes** (300 seconds)
- Reason: Balance between data freshness and API cost reduction

### Cache Keys

- Username lookups: `clerk:username:{username}`
- User ID lookups: `clerk:id:{userId}`
- Batch lookups: `clerk:ids:{user1},{user2},...` (max 10 users)

### Redis Prefixes

All Clerk cache keys use the `clerk:` prefix to separate from other cache types (Stripe, forms, etc.).

## Usage Examples

### Basic User Lookup

```typescript
// Server Component
import { getCachedUserByUsername } from '@/lib/cache/clerk-cache';

export default async function ExpertProfilePage({ params }: { params: { username: string } }) {
  const user = await getCachedUserByUsername(params.username);

  if (!user) {
    return <div>Expert not found</div>;
  }

  return <ExpertProfile user={user} />;
}
```

### Batch User Lookup

```typescript
// Fetch multiple experts for a list
import { getCachedUsersByIds } from '@/lib/cache/clerk-cache';

export async function getExpertList(expertIds: string[]) {
  const experts = await getCachedUsersByIds(expertIds);
  return experts;
}
```

### Cache Invalidation

```typescript
import { invalidateUserCache } from '@/lib/cache/clerk-cache';

// After user profile update
async function updateUserProfile(userId: string, data: ProfileData) {
  await updateProfile(userId, data);
  await invalidateUserCache(userId);
}
```

## Performance Benefits

### Before Caching

- **Clerk API calls**: ~500/minute during peak
- **Response time**: 200-500ms per call
- **Cost**: High API usage

### After Caching

- **Clerk API calls**: ~50/minute during peak (90% reduction)
- **Response time**: 10-50ms (from Redis) or instant (from React.cache)
- **Cost**: Significant reduction in API usage

## Monitoring

### Cache Hit Rate

Monitor cache effectiveness in PostHog:

```typescript
// Tracked automatically in clerk-cache.ts
posthog.capture('clerk_cache_hit', {
  cacheType: 'redis',
  operation: 'getUserByUsername',
});

posthog.capture('clerk_cache_miss', {
  cacheType: 'redis',
  operation: 'getUserByUsername',
});
```

### Redis Health

Check Redis connectivity:

```bash
curl https://eleva.care/api/health/upstash-redis
```

## Troubleshooting

### High Cache Miss Rate

**Symptoms:** > 50% cache misses

**Possible Causes:**

1. TTL too short
2. High volume of unique usernames
3. Cache not warmed up after deployment

**Solutions:**

- Increase TTL to 10 minutes for specific use cases
- Pre-warm cache for frequently accessed users
- Review cache key generation logic

### Redis Connection Failures

**Symptoms:** All requests hitting Clerk API

**Fallback Behavior:**

- Redis failures don't break functionality
- Requests fall through to Clerk API directly
- Errors logged for monitoring

**Solutions:**

1. Check Redis health endpoint
2. Verify environment variables
3. Check Upstash dashboard for issues

## Best Practices

1. **Always use cached functions**: Never call Clerk API directly in user-facing code
2. **Batch when possible**: Use `getCachedUsersByIds` for multiple users
3. **Monitor cache hits**: Track performance via PostHog
4. **Invalidate on updates**: Clear cache after profile changes
5. **Handle failures gracefully**: Always have fallback to direct API

## Configuration

### Environment Variables

```bash
# Redis connection (required)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Clerk API (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Cache Settings

Located in `lib/cache/clerk-cache.ts`:

```typescript
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes
  batchSize: 500, // Clerk API limit
  maxCachedBatchSize: 10, // Max users to cache as batch
};
```

---

**Location**: `lib/cache/clerk-cache.ts`  
**Related**: [Redis Implementation](./01-redis-caching.md), [Rate Limiting](./04-rate-limiting.md)  
**Last Updated**: January 2025
