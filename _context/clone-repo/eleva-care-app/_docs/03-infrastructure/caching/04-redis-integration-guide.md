# Redis Integration Rule - Eleva Care

## 🎯 **Overview**

This rule provides comprehensive guidelines for implementing Redis caching throughout the Eleva Care application. Follow these patterns to ensure consistent, secure, and performant Redis integration.

## 📚 **Redis Cache Systems Available**

### **Production Ready Systems**

- **IdempotencyCache** - Payment duplicate prevention
- **FormCache** - Frontend form submission prevention
- **CustomerCache** - Stripe customer/subscription caching

### **Implementation Ready Systems**

- **RateLimitCache** - Distributed rate limiting with sliding windows
- **NotificationQueueCache** - Notification batching and delivery management
- **AnalyticsCache** - Metrics and performance data caching
- **SessionCache** - Enhanced session data storage
- **DatabaseCache** - Query result caching for frequently accessed data
- **TempDataCache** - Multi-step process data storage

## 🔧 **Implementation Guidelines**

### **1. Cache Key Naming Convention**

```typescript
// ✅ GOOD: Consistent, hierarchical naming
const cacheKey = `user_profile:${userId}`;
const rateLimitKey = `rate_limit:${endpoint}:${userId}:${timeWindow}`;
const sessionKey = `session:${userId}:${deviceId}`;

// ❌ BAD: Inconsistent, unclear naming
const key = `user${userId}`;
const limit = `${userId}_limit`;
```

**Pattern**: `{system}:{entity}:{identifier}:{optional_context}`

### **2. TTL (Time To Live) Strategy**

```typescript
// ✅ GOOD: Appropriate TTL based on data type
await DatabaseCache.set(`user_profile:${userId}`, profile, 3600); // 1 hour
await SessionCache.set(`session:${userId}`, sessionData, 1800); // 30 minutes
await RateLimitCache.set(`rate_limit:${key}`, count, 300); // 5 minutes

// ❌ BAD: No TTL or inappropriate duration
await redis.set(key, data); // No expiration
await redis.set(key, data, 86400); // 24 hours for frequently changing data
```

**TTL Guidelines**:

- **User profiles**: 1-2 hours
- **Session data**: 15-30 minutes
- **Rate limiting**: 5-15 minutes
- **Analytics**: 30 minutes - 2 hours
- **Temporary data**: Based on workflow (10 minutes - 7 days)

### **3. Error Handling and Fallbacks**

```typescript
// ✅ GOOD: Graceful fallback with error handling
async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    // Try cache first
    const cached = await DatabaseCache.get(`user_profile:${userId}`);
    if (cached) return cached;

    // Fallback to database
    const profile = await db.getUserProfile(userId);

    // Cache for future requests
    await DatabaseCache.set(`user_profile:${userId}`, profile, 3600);

    return profile;
  } catch (cacheError) {
    console.error('Cache error:', cacheError);
    // Always fallback to database
    return await db.getUserProfile(userId);
  }
}

// ❌ BAD: No fallback, throws on cache failure
async function getUserProfile(userId: string): Promise<UserProfile> {
  const cached = await DatabaseCache.get(`user_profile:${userId}`);
  return cached || await db.getUserProfile(userId); // Throws if cache fails
}
```

### **4. Cache Invalidation Patterns**

```typescript
// ✅ GOOD: Targeted invalidation with related data
async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  // Update database
  const updatedProfile = await db.updateUserProfile(userId, updates);

  // Invalidate related caches
  await Promise.all([
    DatabaseCache.invalidate(`user_profile:${userId}`),
    DatabaseCache.invalidatePattern(`user_appointments:${userId}:*`),
    DatabaseCache.invalidate(`dashboard:user:${userId}`),
    SessionCache.invalidate(`session:${userId}`),
  ]);

  return updatedProfile;
}

// ❌ BAD: Over-invalidation or missing invalidation
async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  const updatedProfile = await db.updateUserProfile(userId, updates);

  // Over-invalidation
  await DatabaseCache.clear(); // Clears everything!

  // Or missing invalidation - stale data remains
  return updatedProfile;
}
```

### **5. Rate Limiting Implementation**

```typescript
// ✅ GOOD: Multi-layer rate limiting with proper limits
async function checkRateLimit(userId: string, action: string): Promise<RateLimitResult> {
  const limits = {
    user: { count: 100, window: 3600 }, // 100 per hour per user
    ip: { count: 200, window: 3600 },   // 200 per hour per IP
    global: { count: 10000, window: 300 }, // 10k per 5 minutes globally
  };

  const checks = await Promise.all([
    RateLimitCache.checkLimit(`${action}:user:${userId}`, limits.user),
    RateLimitCache.checkLimit(`${action}:ip:${clientIP}`, limits.ip),
    RateLimitCache.checkLimit(`${action}:global`, limits.global),
  ]);

  const blocked = checks.find(check => !check.allowed);
  return blocked || { allowed: true };
}

// ❌ BAD: Single layer, inappropriate limits
async function checkRateLimit(userId: string): Promise<boolean> {
  const count = await RateLimitCache.increment(`user:${userId}`);
  return count <= 1000; // Too high, no time window
}
```

### **6. Analytics Caching Patterns**

```typescript
// ✅ GOOD: Intelligent caching with background refresh
async function getDashboardAnalytics(userId: string): Promise<Analytics> {
  const cacheKey = `analytics:dashboard:${userId}`;

  // Try cache first
  const cached = await AnalyticsCache.getWithMetadata(cacheKey);

  if (cached) {
    // Check if we should refresh in background
    const age = Date.now() - cached.timestamp;
    if (age > 20 * 60 * 1000) { // 20 minutes
      // Refresh in background
      refreshAnalyticsInBackground(userId);
    }
    return cached.data;
  }

  // Generate fresh analytics
  const analytics = await generateAnalytics(userId);
  await AnalyticsCache.set(cacheKey, analytics, 1800); // 30 minutes

  return analytics;
}

// ❌ BAD: No background refresh, blocking regeneration
async function getDashboardAnalytics(userId: string): Promise<Analytics> {
  const cached = await AnalyticsCache.get(`analytics:${userId}`);
  if (cached) return cached;

  // Blocks user while regenerating
  const analytics = await generateAnalytics(userId); // Slow operation
  await AnalyticsCache.set(`analytics:${userId}`, analytics);
  return analytics;
}
```

### **7. Session Management Best Practices**

```typescript
// ✅ GOOD: Optimized session data with core/extended split
async function getSessionData(userId: string): Promise<SessionData> {
  // Get core data first (frequently needed)
  const coreData = await SessionCache.get(`session:core:${userId}`);

  if (!coreData) {
    return null; // Session expired
  }

  // Get extended data only when needed
  const extendedData = await SessionCache.get(`session:extended:${userId}`);

  return { ...coreData, ...extendedData };
}

async function setSessionData(userId: string, sessionData: SessionData) {
  const { core, extended } = splitSessionData(sessionData);

  await Promise.all([
    SessionCache.set(`session:core:${userId}`, core, 900),    // 15 minutes
    SessionCache.set(`session:extended:${userId}`, extended, 3600), // 1 hour
  ]);
}

// ❌ BAD: Monolithic session data
async function setSessionData(userId: string, sessionData: SessionData) {
  await SessionCache.set(`session:${userId}`, sessionData, 1800);
  // All data expires together, inefficient
}
```

### **8. Temporary Data Management**

```typescript
// ✅ GOOD: Secure temporary data with proper expiration
async function saveFormProgress(userId: string, formId: string, data: any) {
  const progressKey = `form_progress:${userId}:${formId}`;

  const progressData = {
    formData: data,
    lastUpdated: Date.now(),
    expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };

  // Store with automatic expiration
  await TempDataCache.storeTemporaryData(progressKey, progressData, 24 * 3600);
}

async function getFormProgress(userId: string, formId: string) {
  const progress = await TempDataCache.getTemporaryData(`form_progress:${userId}:${formId}`);

  if (!progress) return null;

  // Validate expiration
  if (Date.now() > progress.expiresAt) {
    await TempDataCache.removeTemporaryData(`form_progress:${userId}:${formId}`);
    return null;
  }

  return progress;
}

// ❌ BAD: No expiration validation, security risk
async function saveFormProgress(userId: string, data: any) {
  await redis.set(`form:${userId}`, JSON.stringify(data));
  // No expiration, data persists forever
}
```

## 🚨 **Security Guidelines**

### **1. Data Sanitization**

```typescript
// ✅ GOOD: Sanitize sensitive data before caching
async function cacheUserProfile(userId: string, profile: UserProfile) {
  const sanitizedProfile = {
    ...profile,
    // Remove sensitive fields
    password: undefined,
    ssn: undefined,
    creditCard: undefined,
  };

  await DatabaseCache.set(`user_profile:${userId}`, sanitizedProfile, 3600);
}

// ❌ BAD: Caching sensitive data
await DatabaseCache.set(`user:${userId}`, userWithPassword, 3600);
```

### **2. Access Control**

```typescript
// ✅ GOOD: User-scoped cache keys
async function getUserData(requestingUserId: string, targetUserId: string) {
  // Ensure user can only access their own data
  if (requestingUserId !== targetUserId && !isAdmin(requestingUserId)) {
    throw new Error('Unauthorized access');
  }

  return await DatabaseCache.get(`user_profile:${targetUserId}`);
}

// ❌ BAD: No access control
async function getUserData(userId: string) {
  return await DatabaseCache.get(`user_profile:${userId}`);
  // Anyone can access any user's data
}
```

## 📊 **Monitoring and Metrics**

### **1. Cache Performance Tracking**

```typescript
// ✅ GOOD: Track cache performance
async function getCachedData(key: string) {
  const startTime = Date.now();

  try {
    const data = await DatabaseCache.get(key);
    const duration = Date.now() - startTime;

    // Track metrics
    await AnalyticsCache.incrementMetric('cache_hits', 1);
    await AnalyticsCache.recordMetric('cache_response_time', duration);

    return data;
  } catch (error) {
    await AnalyticsCache.incrementMetric('cache_errors', 1);
    throw error;
  }
}
```

### **2. Cache Hit Rate Monitoring**

```typescript
// ✅ GOOD: Monitor cache effectiveness
async function monitorCachePerformance() {
  const metrics = {
    hitRate: await AnalyticsCache.getMetric('cache_hit_rate'),
    avgResponseTime: await AnalyticsCache.getMetric('avg_cache_response_time'),
    errorRate: await AnalyticsCache.getMetric('cache_error_rate'),
  };

  // Alert if performance degrades
  if (metrics.hitRate < 0.8) {
    await sendAlert('Low cache hit rate', metrics);
  }
}
```

## 🔄 **Integration Patterns**

### **1. API Route Integration**

```typescript
// ✅ GOOD: Consistent cache integration in API routes
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    // Check rate limits first
    const rateLimitResult = await RateLimitCache.checkLimit(`api:profile:${userId}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Try cache
    const cached = await DatabaseCache.get(`user_profile:${userId}`);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch from database
    const profile = await db.getUserProfile(userId);

    // Cache for future requests
    await DatabaseCache.set(`user_profile:${userId}`, profile, 3600);

    return NextResponse.json(profile);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### **2. Middleware Integration**

```typescript
// ✅ GOOD: Cache-aware middleware
export async function middleware(request: NextRequest) {
  const { userId } = auth();

  if (userId) {
    // Get cached session data
    let sessionData = await SessionCache.get(`session:${userId}`);

    if (!sessionData) {
      // Refresh session data
      sessionData = await refreshSessionData(userId);
      await SessionCache.set(`session:${userId}`, sessionData, 1800);
    }

    // Add to request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-session-data', JSON.stringify(sessionData));

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}
```

## 🎯 **Performance Optimization**

### **1. Batch Operations**

```typescript
// ✅ GOOD: Batch cache operations
async function getUserProfiles(userIds: string[]): Promise<UserProfile[]> {
  const cacheKeys = userIds.map(id => `user_profile:${id}`);
  const cachedProfiles = await DatabaseCache.mget(cacheKeys);

  // Find missing profiles
  const missingIds = userIds.filter((id, index) => !cachedProfiles[index]);

  if (missingIds.length > 0) {
    // Batch fetch missing profiles
    const missingProfiles = await db.getUserProfiles(missingIds);

    // Batch cache missing profiles
    const cacheOperations = missingProfiles.map(profile =>
      DatabaseCache.set(`user_profile:${profile.id}`, profile, 3600)
    );
    await Promise.all(cacheOperations);
  }

  return combineResults(userIds, cachedProfiles, missingProfiles);
}

// ❌ BAD: Individual cache operations
async function getUserProfiles(userIds: string[]): Promise<UserProfile[]> {
  const profiles = [];
  for (const userId of userIds) {
    const profile = await DatabaseCache.get(`user_profile:${userId}`);
    profiles.push(profile);
  }
  return profiles;
}
```

## 📋 **Implementation Checklist**

When implementing Redis caching:

- [ ] **Choose appropriate cache system** from available options
- [ ] **Follow naming conventions** for cache keys
- [ ] **Set appropriate TTL** based on data type
- [ ] **Implement error handling** with database fallback
- [ ] **Add cache invalidation** for data updates
- [ ] **Sanitize sensitive data** before caching
- [ ] **Add performance monitoring** and metrics
- [ ] **Test cache behavior** under various scenarios
- [ ] **Document cache strategy** for the feature
- [ ] **Consider batch operations** for multiple items

## 🚀 **Quick Start Templates**

### **Basic Cache Implementation**

```typescript
import { DatabaseCache } from '@/lib/redis';

async function getCachedData(key: string, fetchFn: () => Promise<any>, ttl: number = 3600) {
  try {
    const cached = await DatabaseCache.get(key);
    if (cached) return cached;

    const data = await fetchFn();
    await DatabaseCache.set(key, data, ttl);
    return data;
  } catch (error) {
    console.error('Cache error:', error);
    return await fetchFn();
  }
}
```

### **Rate Limiting Template**

```typescript
import { RateLimitCache } from '@/lib/redis';

async function checkRateLimit(identifier: string, action: string) {
  const result = await RateLimitCache.checkLimit(`rate_limit:${action}:${identifier}`, {
    count: 100,
    window: 3600,
  });

  if (!result.allowed) {
    throw new Error('Rate limit exceeded');
  }
}
```

**Remember**: Always prioritize data consistency, security, and user experience when implementing Redis caching. When in doubt, favor conservative TTL values and comprehensive error handling.

### Atomic Slot Reservation (Race Condition Prevention)

**Critical Pattern**: Always use database transactions for slot reservation to prevent double-booking.

```typescript
// ✅ CORRECT: Atomic reservation with transaction
await db.transaction(async (tx) => {
  // Re-check conflicts within transaction
  const conflictCheck = await tx.query.SlotReservationTable.findFirst({
    where: and(
      eq(SlotReservationTable.eventId, eventId),
      eq(SlotReservationTable.startTime, startTime),
      gt(SlotReservationTable.expiresAt, new Date()),
    ),
  });

  if (conflictCheck) {
    // Expire Stripe session and throw error
    await stripe.checkout.sessions.expire(sessionId);
    throw new Error(`Race condition detected: conflicting user: ${conflictCheck.guestEmail}`);
  }

  // Create reservation with conflict handling
  const reservation = await tx
    .insert(SlotReservationTable)
    .values({
      eventId,
      clerkUserId,
      guestEmail,
      startTime,
      endTime,
      expiresAt,
      stripeSessionId: sessionId,
    })
    .onConflictDoNothing({
      target: [
        SlotReservationTable.eventId,
        SlotReservationTable.startTime,
        SlotReservationTable.guestEmail,
      ],
    })
    .returning({ id: SlotReservationTable.id });

  // Validate insertion success
  if (reservation.length === 0) {
    throw new Error('Unique constraint violation: Another reservation exists');
  }

  return reservation[0];
});
```

```typescript
// ❌ WRONG: Non-atomic check + insert (race condition vulnerability)
const existing = await db.query.SlotReservationTable.findFirst({...});
if (existing) {
  return conflict;
}
// [GAP: Another request can create reservation here]
await db.insert(SlotReservationTable).values({...}); // Race condition!
```

**Implementation Checklist**:

- ✅ Wrap check + insert in `db.transaction()`
- ✅ Use `onConflictDoNothing()` with unique constraint targeting
- ✅ Validate insertion success (check returned array length)
- ✅ Expire Stripe sessions on conflicts
- ✅ Return appropriate HTTP status codes (409 for races, 500 for failures)
- ✅ Link payment intents to reservations via session_id metadata

### Core Cache Utilities

All cache utilities use **object literal pattern** (not static classes):
