# Redis Caching Implementation

## Overview

This document describes the unified Redis implementation that consolidates all caching functionality into a single, centralized solution using Upstash Redis. All caching needs (Clerk user data, Stripe customer data, form submissions, rate limiting) use one Redis client with different prefixes.

## 🔄 Migration Summary

### **Before: Fragmented Caching**

```typescript
// Multiple Redis instances with different configurations
// lib/stripe.ts - KV_REST_API_URL/KV_REST_API_TOKEN
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? '',
  token: process.env.KV_REST_API_TOKEN ?? '',
});

// lib/redis.ts - UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// In-memory caches in components
const idempotencyCache = new Map<string, { url: string; timestamp: number }>();
```

### **After: Unified Redis Solution**

```typescript
// Single Redis manager with multiple cache utilities
import { CustomerCache, FormCache, IdempotencyCache, redisManager } from '@/lib/redis';

// All caches use the same Redis instance with different prefixes
// idempotency:*, form:*, customer:*, user:*, email:*, subscription:*
```

## 🏗️ Architecture

### **Core Redis Manager**

```typescript
class RedisManager {
  private redis: Redis | null = null;
  private inMemoryCache: Map<string, { value: string; expiresAt: number }> = new Map();
  private isRedisAvailable = false;

  // Automatic fallback to in-memory cache if Redis unavailable
  async set(key: string, value: string, expirationSeconds?: number): Promise<void>;
  async get(key: string): Promise<string | null>;
  async del(key: string): Promise<void>;
  async exists(key: string): Promise<boolean>;
}
```

### **Specialized Cache Utilities**

#### **1. IdempotencyCache (API Duplicate Prevention)**

```typescript
export class IdempotencyCache {
  private static readonly CACHE_PREFIX = 'idempotency:';
  private static readonly DEFAULT_TTL_SECONDS = 600; // 10 minutes

  static async set(key: string, result: { url: string }): Promise<void>;
  static async get(key: string): Promise<{ url: string } | null>;
}
```

#### **2. FormCache (Frontend Duplicate Prevention)**

```typescript
export class FormCache {
  private static readonly CACHE_PREFIX = 'form:';
  private static readonly DEFAULT_TTL_SECONDS = 300; // 5 minutes

  static async set(key: string, formData: FormSubmissionData): Promise<void>;
  static async isProcessing(key: string): Promise<boolean>;
  static async markCompleted(key: string): Promise<void>;
  static async markFailed(key: string): Promise<void>;
  static generateKey(eventId: string, guestEmail: string, startTime: string): string;
}
```

#### **3. CustomerCache (User Session & Stripe Data)**

```typescript
export class CustomerCache {
  private static readonly CACHE_PREFIX = 'customer:';
  private static readonly USER_PREFIX = 'user:';
  private static readonly EMAIL_PREFIX = 'email:';
  private static readonly SUBSCRIPTION_PREFIX = 'subscription:';

  static async setCustomer(customerId: string, customerData: CachedCustomerData): Promise<void>;
  static async getCustomer(customerId: string): Promise<CachedCustomerData | null>;
  static async setUserMapping(userId: string, customerId: string): Promise<void>;
  static async getCustomerByUserId(userId: string): Promise<string | null>;
  static async setEmailMapping(email: string, customerId: string): Promise<void>;
  static async getCustomerByEmail(email: string): Promise<string | null>;
}
```

## 🔧 Environment Configuration

### **Unified Environment Variables**

Use **ONE** set of Redis credentials for everything:

```bash
# Production (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Development (optional - falls back to in-memory)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

### **Deprecated Variables (Remove These)**

```bash
# ❌ No longer needed - remove from .env files
# KV_REST_API_URL=
# KV_REST_API_TOKEN=
# KV_REST_API_READ_ONLY_TOKEN=
```

## 📝 Usage Examples

### **1. MeetingForm.tsx - Frontend Duplicate Prevention**

```typescript
import { FormCache } from '@/lib/redis';

const createPaymentIntent = async () => {
  // Generate cache key
  const formCacheKey = FormCache.generateKey(eventId, guestEmail, startTime);

  // Check if already processing
  const isAlreadyProcessing = await FormCache.isProcessing(formCacheKey);
  if (isAlreadyProcessing) {
    console.log('🚫 Form submission already in progress - blocking duplicate');
    return null;
  }

  try {
    // Mark as processing
    await FormCache.set(formCacheKey, {
      eventId,
      guestEmail,
      startTime,
      status: 'processing',
      timestamp: Date.now(),
    });

    // Create payment intent...
    const response = await fetch('/api/create-payment-intent', { ... });

    // Mark as completed
    await FormCache.markCompleted(formCacheKey);
    return response.url;
  } catch (error) {
    // Mark as failed
    await FormCache.markFailed(formCacheKey);
    throw error;
  }
};
```

### **2. create-payment-intent API - Backend Idempotency**

```typescript
import { IdempotencyCache } from '@/lib/redis';

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key');

  if (idempotencyKey) {
    // Check cache
    const cachedResult = await IdempotencyCache.get(idempotencyKey);
    if (cachedResult) {
      return NextResponse.json({ url: cachedResult.url });
    }
  }

  // Process request...
  const session = await stripe.checkout.sessions.create({ ... });

  // Cache result
  if (idempotencyKey && session.url) {
    await IdempotencyCache.set(idempotencyKey, { url: session.url });
  }

  return NextResponse.json({ url: session.url });
}
```

### **3. Stripe Integration - Customer Cache**

```typescript
import { CustomerCache } from '@/lib/redis';

export async function getOrCreateStripeCustomer(userId?: string, email?: string, name?: string) {
  // Try to get from cache first
  if (userId) {
    const cachedCustomerId = await CustomerCache.getCustomerByUserId(userId);
    if (cachedCustomerId) {
      const customerData = await CustomerCache.getCustomer(cachedCustomerId);
      if (customerData) return cachedCustomerId;
    }
  }

  if (email) {
    const cachedCustomerId = await CustomerCache.getCustomerByEmail(email);
    if (cachedCustomerId) return cachedCustomerId;
  }

  // Create new customer in Stripe
  const customer = await stripe.customers.create({ email, name });

  // Store in cache
  const customerData = {
    stripeCustomerId: customer.id,
    email: email || '',
    userId,
    name,
    subscriptions: [],
    defaultPaymentMethod: null,
    created: customer.created,
    updatedAt: Date.now(),
  };

  await CustomerCache.setCustomer(customer.id, customerData);
  if (userId) await CustomerCache.setUserMapping(userId, customer.id);
  if (email) await CustomerCache.setEmailMapping(email, customer.id);

  return customer.id;
}
```

## 🎯 Cache Key Prefixes

All cache utilities use distinct prefixes to avoid collisions:

```
idempotency:${key}     -> API request deduplication
form:${key}           -> Frontend form submission states
customer:${id}        -> Stripe customer data
user:${userId}        -> User ID to customer ID mapping
email:${email}        -> Email to customer ID mapping
subscription:${id}    -> Subscription data
```

## 🔍 Monitoring & Health Checks

### **Unified Health Check**

```typescript
// Check overall Redis health
const health = await redisManager.healthCheck();

// Check specific cache utilities
const customerHealth = await CustomerCache.healthCheck();
const idempotencyStats = redisManager.getCacheStats();
```

### **Cache Statistics**

```typescript
const stats = redisManager.getCacheStats();
// {
//   isRedisAvailable: true,
//   inMemoryCacheSize: 0,
//   cacheType: 'Redis'
// }
```

## 🚀 Migration Steps

### **1. Update Environment Variables**

```bash
# Add to .env files
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Remove old variables
# KV_REST_API_URL=
# KV_REST_API_TOKEN=
```

### **2. Update Import Statements**

```typescript
// Before
import { Redis } from '@upstash/redis';
const redis = new Redis({ ... });

// After
import { CustomerCache, IdempotencyCache, FormCache } from '@/lib/redis';
```

### **3. Migrate lib/stripe.ts**

Replace the existing Redis client in `lib/stripe.ts` with the unified `CustomerCache`:

```typescript
// After
import { CustomerCache } from '@/lib/redis';

// Before
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? '',
  token: process.env.KV_REST_API_TOKEN ?? '',
});

// Replace redis.set() calls with CustomerCache.setCustomer()
// Replace redis.get() calls with CustomerCache.getCustomer()
```

### **4. Update Frontend Components**

Replace in-memory caches with `FormCache`:

```typescript
// After
import { FormCache } from '@/lib/redis';

// Before
const [isProcessing, setIsProcessing] = useState(false);
const requestRef = useRef<string | null>(null);

const isAlreadyProcessing = await FormCache.isProcessing(cacheKey);
```

## 📊 Performance Benefits

### **Before vs After**

| Aspect                    | Before (Fragmented)       | After (Unified)          |
| ------------------------- | ------------------------- | ------------------------ |
| **Redis Connections**     | 2+ separate instances     | 1 shared instance        |
| **Memory Usage**          | Higher per instance       | Optimized sharing        |
| **Code Complexity**       | Scattered implementations | Centralized utilities    |
| **Environment Variables** | 4+ Redis variables        | 2 Redis variables        |
| **Cache Consistency**     | No cross-cache visibility | Unified cache namespace  |
| **Debugging**             | Multiple systems to check | Single system to monitor |
| **Maintenance**           | Multiple configurations   | Single configuration     |

### **Scalability Improvements**

- **Horizontal Scaling**: All caches work across server instances
- **Memory Efficiency**: Shared Redis connection and pooling
- **Operational Simplicity**: Single Redis cluster to manage
- **Cost Optimization**: One Redis service instead of multiple

## 🔐 Security & Reliability

### **Fault Tolerance**

- **Graceful Degradation**: Automatic fallback to in-memory cache
- **Error Recovery**: Corrupted cache entries automatically cleaned up
- **Connection Resilience**: Automatic retry logic with Upstash Redis

### **Data Consistency**

- **TTL Management**: Automatic expiration handled by Redis
- **Cache Invalidation**: Explicit cleanup methods for each cache type
- **Atomic Operations**: Redis transactions for complex updates

## 🎯 Future Enhancements

### **Potential Optimizations**

1. **Cache Warming**: Preload frequently accessed data
2. **Compression**: Compress large cached objects
3. **Analytics**: Detailed cache hit/miss tracking
4. **Multi-Region**: Global Redis replication

### **Additional Cache Types**

- **Rate Limiting**: Request throttling cache
- **Session Management**: Enhanced user session handling
- **Temporary Data**: Short-lived operational data

---

**Status**: ✅ **Production Ready**

- All cache types implemented and tested
- Environment variables unified
- Migration path documented
- Performance optimized for production scale

This unified Redis implementation provides a solid foundation for all caching needs while maintaining simplicity, performance, and reliability.
