# 🔧 Customer Cache Troubleshooting Guide

> **Comprehensive guide for diagnosing and fixing customer cache-related issues**

## 🎯 Overview

The CustomerCache system is critical for performance and user experience in the Eleva Care platform. This guide helps you diagnose and resolve common cache-related issues.

## 🔍 Common Issues & Solutions

### 1. **Type Mismatch Errors**

**Symptoms:**

- Runtime crashes with JSON parsing errors
- `Unexpected token c in JSON at position 0` errors
- TypeScript type safety violations

**Root Cause:**
Incorrect usage of CustomerCache API methods

**Solution:**

```typescript
// ❌ INCORRECT - Don't do this
const kvUser = await CustomerCache.getCustomerByUserId(userId);
const customerData = JSON.parse(kvUser); // This will fail!

// ✅ CORRECT - Two-step retrieval
const customerId = await CustomerCache.getCustomerByUserId(userId);
const customerData = await CustomerCache.getCustomer(customerId);
```

### 2. **Missing Customer Data**

**Symptoms:**

- `null` or `undefined` customer data
- User sync issues
- Payment failures due to missing customer info

**Diagnosis Steps:**

```typescript
// Check if user ID mapping exists
const customerId = await CustomerCache.getCustomerByUserId(userId);
console.log('Customer ID:', customerId);

// Check if customer data exists
if (customerId) {
  const customerData = await CustomerCache.getCustomer(customerId);
  console.log('Customer Data:', customerData);
}
```

**Solutions:**

1. **Refresh Cache**: Force cache refresh from Stripe
2. **Manual Sync**: Trigger customer data sync
3. **Fallback to Stripe**: Query Stripe directly if cache fails

### 3. **Cache Inconsistency**

**Symptoms:**

- Outdated customer information
- Subscription status mismatches
- Payment method inconsistencies

**Diagnostic API:**

```bash
# Use the check-kv-sync endpoint
GET /api/user/check-kv-sync

# Response will show sync status
{
  "isInSync": false,
  "debug": {
    "hasCustomerData": true,
    "basicDataInSync": false,
    "stripeDataInSync": true
  }
}
```

**Solutions:**

1. **Cache Invalidation**: Clear and rebuild cache
2. **Stripe Sync**: Update cache from Stripe source
3. **Manual Correction**: Fix specific data inconsistencies

## 🛠️ Debugging Tools

### 1. **Cache Health Check**

```typescript
import { CustomerCache } from '@/lib/redis';

async function checkCacheHealth(userId: string) {
  try {
    // Step 1: Check user ID mapping
    const customerId = await CustomerCache.getCustomerByUserId(userId);
    console.log('✅ User ID mapping:', !!customerId);

    if (!customerId) {
      console.log('❌ No customer ID found for user');
      return false;
    }

    // Step 2: Check customer data
    const customerData = await CustomerCache.getCustomer(customerId);
    console.log('✅ Customer data exists:', !!customerData);

    if (!customerData) {
      console.log('❌ No customer data found');
      return false;
    }

    // Step 3: Validate data structure
    const requiredFields = ['stripeCustomerId', 'email', 'userId'];
    const missingFields = requiredFields.filter((field) => !customerData[field]);

    if (missingFields.length > 0) {
      console.log('❌ Missing required fields:', missingFields);
      return false;
    }

    console.log('✅ Cache health check passed');
    return true;
  } catch (error) {
    console.error('❌ Cache health check failed:', error);
    return false;
  }
}
```

### 2. **Data Sync Verification**

```typescript
async function verifyDataSync(userId: string) {
  const customerId = await CustomerCache.getCustomerByUserId(userId);
  const cachedData = await CustomerCache.getCustomer(customerId);

  if (!cachedData) {
    return { synced: false, reason: 'No cached data' };
  }

  // Compare with Clerk data
  const user = await currentUser();
  const emailMatch = cachedData.email === user?.emailAddresses[0]?.emailAddress;
  const nameMatch = cachedData.name === `${user?.firstName} ${user?.lastName}`;

  // Compare with Stripe data
  const stripeCustomer = await stripe.customers.retrieve(cachedData.stripeCustomerId);
  const stripeEmailMatch = stripeCustomer.email === cachedData.email;

  return {
    synced: emailMatch && nameMatch && stripeEmailMatch,
    details: {
      emailMatch,
      nameMatch,
      stripeEmailMatch,
    },
  };
}
```

## 🔄 Cache Refresh Procedures

### 1. **Individual User Refresh**

```typescript
async function refreshUserCache(userId: string) {
  try {
    // 1. Get fresh data from Stripe
    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;

    // 2. Find Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    const stripeCustomer = customers.data[0];

    if (!stripeCustomer) {
      throw new Error('No Stripe customer found');
    }

    // 3. Update cache
    await CustomerCache.setCustomer(stripeCustomer.id, {
      stripeCustomerId: stripeCustomer.id,
      email: stripeCustomer.email,
      userId: userId,
      name: stripeCustomer.name,
      subscriptions: [], // Update with actual subscriptions
      created: stripeCustomer.created,
      updatedAt: Math.floor(Date.now() / 1000),
    });

    // 4. Update user ID mapping
    await CustomerCache.setCustomerByUserId(userId, stripeCustomer.id);

    console.log('✅ Cache refreshed successfully');
    return true;
  } catch (error) {
    console.error('❌ Cache refresh failed:', error);
    return false;
  }
}
```

### 2. **Bulk Cache Refresh**

```typescript
async function bulkRefreshCache(userIds: string[]) {
  const results = [];

  for (const userId of userIds) {
    try {
      const success = await refreshUserCache(userId);
      results.push({ userId, success });
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
    }
  }

  return results;
}
```

## 🚨 Emergency Procedures

### 1. **Cache Fallback Mode**

When cache is completely unavailable:

```typescript
async function getCustomerWithFallback(userId: string) {
  try {
    // Try cache first
    const customerId = await CustomerCache.getCustomerByUserId(userId);
    if (customerId) {
      const cachedData = await CustomerCache.getCustomer(customerId);
      if (cachedData) return cachedData;
    }
  } catch (error) {
    console.warn('Cache unavailable, falling back to Stripe');
  }

  // Fallback to Stripe
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const customers = await stripe.customers.list({ email, limit: 1 });
  const stripeCustomer = customers.data[0];

  if (!stripeCustomer) return null;

  return {
    stripeCustomerId: stripeCustomer.id,
    email: stripeCustomer.email,
    userId: userId,
    name: stripeCustomer.name,
    subscriptions: [],
    created: stripeCustomer.created,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}
```

### 2. **Cache Rebuild**

Complete cache reconstruction:

```typescript
async function rebuildCustomerCache() {
  console.log('🔄 Starting cache rebuild...');

  // 1. Get all users from Clerk
  const users = await clerkClient.users.getUserList();

  // 2. Process each user
  for (const user of users.data) {
    try {
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      // Find corresponding Stripe customer
      const customers = await stripe.customers.list({ email, limit: 1 });
      const stripeCustomer = customers.data[0];

      if (stripeCustomer) {
        await refreshUserCache(user.id);
        console.log(`✅ Rebuilt cache for user ${user.id}`);
      }
    } catch (error) {
      console.error(`❌ Failed to rebuild cache for user ${user.id}:`, error);
    }
  }

  console.log('✅ Cache rebuild completed');
}
```

## 📊 Monitoring & Alerts

### 1. **Cache Health Metrics**

```typescript
async function getCacheHealthMetrics() {
  const metrics = {
    totalUsers: 0,
    cachedUsers: 0,
    syncedUsers: 0,
    errors: [],
  };

  const users = await clerkClient.users.getUserList();
  metrics.totalUsers = users.totalCount;

  for (const user of users.data) {
    try {
      const hasCache = await checkCacheHealth(user.id);
      if (hasCache) {
        metrics.cachedUsers++;

        const syncStatus = await verifyDataSync(user.id);
        if (syncStatus.synced) {
          metrics.syncedUsers++;
        }
      }
    } catch (error) {
      metrics.errors.push({ userId: user.id, error: error.message });
    }
  }

  return metrics;
}
```

### 2. **Automated Alerts**

Set up monitoring for:

- Cache hit rate < 95%
- Sync failures > 5%
- API errors > 1%
- Response time > 500ms

## 🔗 Related Documentation

- [Customer Cache Implementation](../../02-core-systems/caching/02-customer-cache.md)
- [Redis Implementation Guide](../../02-core-systems/caching/01-redis-implementation.md)
- [Payment Flow Verification](./02-payment-flow-verification.md)

---

**Last updated**: January 1, 2025 | **Next review**: February 1, 2025
