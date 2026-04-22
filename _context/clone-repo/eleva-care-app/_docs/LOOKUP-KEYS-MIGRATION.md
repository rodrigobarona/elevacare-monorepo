# Stripe Lookup Keys Migration

**Date:** November 13, 2025  
**Status:** ✅ Complete  
**Migration:** Hardcoded Price IDs → Lookup Keys

---

## 🎯 Overview

Migrated from hardcoded Stripe price IDs in code to **lookup keys**, following Stripe best practices.

### **Before:**
```typescript
// ❌ Hardcoded price IDs in .env and code
stripePriceId: process.env.STRIPE_PRICE_COMMUNITY_MONTHLY || 'price_1SQbV5K5Ap4Um3SpD65qOwZB'
```

### **After:**
```typescript
// ✅ Lookup keys resolved dynamically
lookupKey: 'community-expert-monthly'
const priceId = await getPriceIdByLookupKey('community-expert-monthly');
```

---

## ✨ Benefits

| Before (Price IDs) | After (Lookup Keys) |
|-------------------|---------------------|
| ❌ Hardcoded in `.env` | ✅ No `.env` needed |
| ❌ Different IDs per environment | ✅ Same keys everywhere |
| ❌ Code deployment to change | ✅ Update via Admin Dashboard |
| ❌ `price_1SQbV5K5Ap4Um3SpD65qOwZB` | ✅ `community-expert-monthly` |
| ❌ Manual sync test→prod | ✅ Keys transfer automatically |

---

## 📁 New Files Created

### **1. `src/config/subscription-lookup-keys.ts`**
Centralized lookup key configuration:

```typescript
export const EXPERT_LOOKUP_KEYS = {
  community: {
    monthly: 'community-expert-monthly',
    annual: 'community-expert-annual',
  },
  top: {
    monthly: 'top-expert-monthly',
    annual: 'top-expert-annual',
  },
} as const;
```

**Features:**
- Type-safe lookup key constants
- Helper functions (`getExpertLookupKey`, `isValidLookupKey`)
- Includes expert, lecturer, and partner keys
- Validation helpers

---

### **2. `src/lib/stripe/price-resolver.ts`**
Dynamic price resolution with caching:

```typescript
// Resolve price by lookup key
const price = await resolvePriceByLookupKey('community-expert-monthly');

// Get price ID directly
const priceId = await getPriceIdByLookupKey('community-expert-monthly');

// Batch resolve multiple prices
const prices = await resolvePricesByLookupKeys([
  'community-expert-monthly',
  'top-expert-monthly',
]);
```

**Features:**
- In-memory caching (5-minute TTL)
- Batch resolution support
- Error handling & logging
- Cache statistics & clearing

**Caching Benefits:**
- 🚀 Fast: Cached responses ~1ms
- 💰 Cost-effective: Reduces Stripe API calls
- 🛡️ Resilient: Cached data available if API fails

---

### **3. `src/config/subscription-pricing-v2.ts`**
Updated pricing config using lookup keys:

```typescript
monthly_subscription: {
  community_expert: {
    monthlyFee: 4900, // $49/month
    commissionRate: 0.12,
    lookupKey: EXPERT_LOOKUP_KEYS.community.monthly, // ✨ NEW
  },
}
```

**Changes from v1:**
- ❌ Removed: `stripePriceId` with hardcoded IDs
- ✅ Added: `lookupKey` fields
- ✅ Corrected: Top Expert monthly fee ($177 vs $155)
- ✅ Corrected: Top Expert annual fee ($1,774 vs $1,490)

---

## 🔄 Files Updated

### **1. `src/server/actions/subscriptions.ts`**

**Before:**
```typescript
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: priceId, quantity: 1 }],
  // ...
});
```

**After:**
```typescript
// Resolve price ID from lookup key (if needed)
let stripePriceId = priceId;
if (!priceId.startsWith('price_')) {
  const resolvedPriceId = await getPriceIdByLookupKey(priceId);
  if (!resolvedPriceId) {
    throw new Error(`No active price found for lookup key: ${priceId}`);
  }
  stripePriceId = resolvedPriceId;
}

const session = await stripe.checkout.sessions.create({
  line_items: [{ price: stripePriceId, quantity: 1 }],
  // ...
});
```

**Backwards Compatible:** Still accepts Stripe price IDs starting with `price_`

---

### **2. `src/components/features/subscriptions/SubscriptionDashboard.tsx`**

**Before:**
```typescript
const priceId =
  eligibility.tierLevel === 'top'
    ? process.env.NEXT_PUBLIC_STRIPE_PRICE_TOP_ANNUAL || 'price_1SQXF5K5Ap4Um3SpzT4S3agl'
    : process.env.NEXT_PUBLIC_STRIPE_PRICE_COMMUNITY_ANNUAL || 'price_1SQXF5K5Ap4Um3SpekZpC9fQ';
```

**After:**
```typescript
const { EXPERT_LOOKUP_KEYS } = await import('@/config/subscription-lookup-keys');
const lookupKey = EXPERT_LOOKUP_KEYS[eligibility.tierLevel].annual;
const result = await createSubscription(lookupKey, eligibility.tierLevel);
```

---

## 📊 Lookup Key Naming Convention

### **Format:**
```
{category}-{tier}-{interval}
```

### **Examples:**
- `community-expert-monthly` → Community Expert Monthly Plan
- `top-expert-annual` → Top Expert Annual Plan
- `partner-professional-monthly` → Partner Professional Monthly Plan
- `lecturer-module-annual` → Lecturer Module Annual Add-on

### **Rules:**
- Lowercase only
- Hyphen-separated
- Descriptive but concise
- Human-readable

---

## 🔧 Creating Prices with Lookup Keys

### **Via Admin Dashboard** (`/admin/subscriptions`):

1. Navigate to `/admin/subscriptions`
2. Click "Add Price" on a product
3. Fill form:
   - Nickname: `Community Expert - Monthly`
   - Amount: `4900` (cents)
   - Currency: `USD`
   - Recurring: ✅ `month` × `1`
   - **Lookup Key:** `community-expert-monthly` ← KEY FIELD
   - Tier: `community`
   - Plan Type: `monthly`
   - Commission Rate: `1200` (12%)
4. Click "Create Price"
5. ✅ Price created with lookup key!

### **Via Stripe API:**
```typescript
await stripe.prices.create({
  product: 'prod_xxx',
  unit_amount: 4900,
  currency: 'usd',
  recurring: { interval: 'month' },
  lookup_key: 'community-expert-monthly', // ← KEY FIELD
  metadata: {
    tier: 'community',
    planType: 'monthly',
    commissionRate: '1200',
  },
});
```

---

## 🧪 Testing Checklist

### **1. Verify Lookup Keys Exist in Stripe:**
```bash
# Check all lookup keys exist
stripe prices list --lookup-keys "community-expert-monthly"
stripe prices list --lookup-keys "top-expert-monthly"
stripe prices list --lookup-keys "community-expert-annual"
stripe prices list --lookup-keys "top-expert-annual"
stripe prices list --lookup-keys "lecturer-module-annual"
```

### **2. Test Resolution:**
```typescript
// In your app or via node REPL
import { resolvePriceByLookupKey } from '@/lib/stripe/price-resolver';

const price = await resolvePriceByLookupKey('community-expert-monthly');
console.log(price?.id); // Should print: price_xxx
console.log(price?.unit_amount); // Should print: 4900
```

### **3. Test Subscription Flow:**
1. Navigate to `/dashboard/subscription`
2. Click "Upgrade to Annual Plan"
3. Verify checkout session created
4. Check Stripe Dashboard for correct price used

### **4. Verify Cache Works:**
```typescript
import { getCacheStats, clearPriceCache } from '@/lib/stripe/price-resolver';

console.log(getCacheStats()); // Shows cached keys
clearPriceCache(); // Clears cache
```

---

## 🔒 Environment Variables

### **Before:**
```bash
# ❌ OLD: Required in .env
STRIPE_PRICE_COMMUNITY_MONTHLY=price_1SQbV5K5Ap4Um3SpD65qOwZB
STRIPE_PRICE_TOP_MONTHLY=price_1SQbV6K5Ap4Um3SpwFKRCoJo
STRIPE_PRICE_COMMUNITY_ANNUAL=price_1SQXF5K5Ap4Um3SpekZpC9fQ
STRIPE_PRICE_TOP_ANNUAL=price_1SQXF5K5Ap4Um3SpzT4S3agl
STRIPE_PRICE_LECTURER_ADDON_ANNUAL=price_1SQXF5K5Ap4Um3SpQCBwSFml
```

### **After:**
```bash
# ✅ NEW: Only Stripe keys needed
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs are resolved dynamically via lookup keys!
```

**Result:** **5 fewer environment variables!** 🎉

---

## 📝 Migration Checklist

### **For Existing Prices:**

1. ✅ Add lookup keys to existing prices in Stripe:
   ```bash
   stripe prices update price_1SQbV5K5Ap4Um3SpD65qOwZB \
     --lookup-key community-expert-monthly
   
   stripe prices update price_1SQXF5K5Ap4Um3SpekZpC9fQ \
     --lookup-key community-expert-annual
   
   stripe prices update price_1SQbV6K5Ap4Um3SpwFKRCoJo \
     --lookup-key top-expert-monthly
   
   stripe prices update price_1SQXF5K5Ap4Um3SpzT4S3agl \
     --lookup-key top-expert-annual
   
   stripe prices update price_1SQXF5K5Ap4Um3SpQCBwSFml \
     --lookup-key lecturer-module-annual
   ```

2. ✅ Test price resolution in development
3. ✅ Update code to use lookup keys (DONE)
4. ✅ Remove old `.env` price ID variables
5. ✅ Deploy to production
6. ✅ Verify production lookups work

### **For New Prices:**

1. Create via `/admin/subscriptions` with lookup key
2. OR create via Stripe API with `lookup_key` parameter
3. Test resolution
4. Deploy

---

## 🐛 Troubleshooting

### **Issue: "No active price found for lookup key"**

**Cause:** Lookup key doesn't exist or price is archived

**Solution:**
```bash
# Check if price exists
stripe prices list --lookup-keys "community-expert-monthly"

# If archived, activate it
stripe prices update price_xxx --active true

# If doesn't exist, create it
stripe prices create \
  --product prod_xxx \
  --unit-amount 4900 \
  --currency usd \
  --recurring interval=month \
  --lookup-key community-expert-monthly
```

---

### **Issue: Cache showing stale data**

**Cause:** Price updated in Stripe but cache not refreshed

**Solution:**
```typescript
import { clearPriceCache } from '@/lib/stripe/price-resolver';
clearPriceCache(); // Force fresh fetch
```

Or wait 5 minutes for cache to expire automatically.

---

### **Issue: Lookup key not found in test mode**

**Cause:** Lookup keys created in live mode, but testing in test mode

**Solution:** Create lookup keys in both test and live modes:

```bash
# Test mode
stripe prices create --api-key sk_test_... \
  --lookup-key community-expert-monthly \
  # ... other params

# Live mode
stripe prices create --api-key sk_live_... \
  --lookup-key community-expert-monthly \
  # ... other params
```

---

## 📚 References

- **Stripe Docs:** https://docs.stripe.com/products-prices/manage-prices#lookup-keys
- **Admin Dashboard:** `/admin/subscriptions`
- **Lookup Keys Config:** `src/config/subscription-lookup-keys.ts`
- **Price Resolver:** `src/lib/stripe/price-resolver.ts`
- **Pricing Config v2:** `src/config/subscription-pricing-v2.ts`

---

## 🎉 Summary

### **Removed:**
- ❌ 5 environment variables
- ❌ Hardcoded price IDs in code
- ❌ Test/prod price ID management headache

### **Added:**
- ✅ `subscription-lookup-keys.ts` (95 lines)
- ✅ `price-resolver.ts` (155 lines)
- ✅ `subscription-pricing-v2.ts` (428 lines)
- ✅ Backward compatibility with existing price IDs

### **Benefits:**
- 🚀 No code deployments to change prices
- 🌍 Same keys work in test & production
- 📝 Human-readable identifiers
- 💰 5-minute caching reduces API calls
- 🛠️ Manage via Admin Dashboard

---

**Document Version:** 1.0  
**Status:** ✅ Complete & Production Ready  
**Created:** November 13, 2025

