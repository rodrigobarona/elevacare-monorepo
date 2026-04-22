# Environment Variables Cleanup

**Date:** November 13, 2025  
**Status:** Optional Cleanup  
**Impact:** None (variables are no longer used in code)

---

## 🎯 Summary

With the lookup keys implementation, **5 environment variables are no longer needed** in your `.env` or `.env.local` files.

---

## ❌ Variables to Remove

These variables are **no longer used** in the codebase:

```bash
# ❌ DELETE these from .env and .env.local:
STRIPE_PRICE_COMMUNITY_MONTHLY=price_1SQbV5K5Ap4Um3SpD65qOwZB
STRIPE_PRICE_TOP_MONTHLY=price_1SQbV6K5Ap4Um3SpwFKRCoJo
STRIPE_PRICE_COMMUNITY_ANNUAL=price_1SQXF5K5Ap4Um3SpekZpC9fQ
STRIPE_PRICE_TOP_ANNUAL=price_1SQXF5K5Ap4Um3SpzT4S3agl
STRIPE_PRICE_LECTURER_ADDON_ANNUAL=price_1SQXF5K5Ap4Um3SpQCBwSFml
```

---

## ✅ Variables to KEEP

**Keep these** - they are still required:

```bash
# ✅ KEEP - Required for Stripe API
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ✅ KEEP - Required for WorkOS
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_COOKIE_PASSWORD=...

# ✅ KEEP - All other environment variables
DATABASE_URL=...
NEXTAUTH_SECRET=...
# ... etc
```

---

## 🔍 Where Were These Variables Used?

### **Before (Old Code):**

```typescript
// ❌ OLD: src/config/subscription-pricing.ts
export const SUBSCRIPTION_PRICING = {
  monthly_subscription: {
    community_expert: {
      stripePriceId: process.env.STRIPE_PRICE_COMMUNITY_MONTHLY || 'price_1SQbV5...',
      //            ↑ ❌ No longer used
    },
  },
};
```

### **After (New Code):**

```typescript
// ✅ NEW: src/config/subscription-pricing-v2.ts
import { EXPERT_LOOKUP_KEYS } from './subscription-lookup-keys';

export const SUBSCRIPTION_PRICING = {
  monthly_subscription: {
    community_expert: {
      lookupKey: EXPERT_LOOKUP_KEYS.community.monthly, // ✅ Uses lookup key constant
      // No environment variable needed!
    },
  },
};
```

---

## 📝 How to Clean Up

### **Option 1: Manual Cleanup**

1. Open `.env`:

   ```bash
   nano .env
   ```

2. Remove the 5 `STRIPE_PRICE_*` lines

3. Save and exit

4. Repeat for `.env.local` if it exists

---

### **Option 2: Using sed (Automatic)**

```bash
cd /Users/rodrigo.barona/Documents/GitHub/eleva-care-app

# Backup first
cp .env .env.backup

# Remove STRIPE_PRICE_* variables
sed -i '' '/^STRIPE_PRICE_/d' .env

# Verify
grep STRIPE_PRICE .env || echo "✅ All STRIPE_PRICE_ variables removed"
```

---

## ⚠️ Important Notes

### **1. Do NOT Remove These Stripe Variables:**

```bash
# ✅ KEEP THESE - Still required!
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

These are **essential** for Stripe API communication.

---

### **2. Deployment Environments**

If you have multiple environments, clean up each one:

- `.env` (development)
- `.env.local` (local overrides)
- `.env.production` (if exists)
- **Vercel/Railway Environment Variables** (production)

---

### **3. Backward Compatibility**

The new code is **backward compatible**:

```typescript
// ✅ Still accepts price IDs directly (starts with 'price_')
if (!priceId.startsWith('price_')) {
  // Only resolve if it's a lookup key
  const resolved = await getPriceIdByLookupKey(priceId);
}
```

**Meaning:** Even if you don't remove the environment variables, the old code paths still work!

---

## 🎯 Benefits of Removal

### **Before:**

```bash
# 8 Stripe-related variables
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_COMMUNITY_MONTHLY=...
STRIPE_PRICE_TOP_MONTHLY=...
STRIPE_PRICE_COMMUNITY_ANNUAL=...
STRIPE_PRICE_TOP_ANNUAL=...
STRIPE_PRICE_LECTURER_ADDON_ANNUAL=...
```

### **After:**

```bash
# 3 Stripe-related variables
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

**Reduction:** 62.5% fewer Stripe environment variables! 🎉

---

## 📊 Verification

After cleanup, verify nothing broke:

```bash
# 1. Check that required variables still exist
grep "^STRIPE_SECRET_KEY" .env
grep "^STRIPE_PUBLISHABLE_KEY" .env
grep "^STRIPE_WEBHOOK_SECRET" .env

# 2. Verify removed variables are gone
grep "^STRIPE_PRICE_" .env && echo "⚠️  Still found!" || echo "✅ Cleaned up!"

# 3. Test application
pnpm dev
# Navigate to /dashboard/subscription
# Try upgrading - should work!
```

---

## 🚀 Deployment Checklist

When deploying to production:

1. **Vercel/Railway Dashboard:**
   - Go to Environment Variables
   - Delete the 5 `STRIPE_PRICE_*` variables
   - Keep the 3 essential Stripe variables

2. **Redeploy:**

   ```bash
   # Trigger redeploy with new env config
   git push origin main
   ```

3. **Verify:**
   - Check production logs for errors
   - Test subscription flows
   - Monitor for 24 hours

---

## 💡 Optional vs. Required

**Priority:** **Low** - This cleanup is optional

**Why?**

- The variables are no longer used in code
- They don't hurt if they exist
- Removal is purely for cleanliness

**When to do it:**

- During your next deployment
- When updating other environment variables
- As part of quarterly cleanup

**Skip if:**

- You're in a rush
- Production is stable
- You prefer to wait and observe

---

## 📚 Reference

### **Files That Used These Variables:**

- ❌ `src/config/subscription-pricing.ts` (deprecated)
- ✅ `src/config/subscription-pricing-v2.ts` (new - uses lookup keys)
- ✅ `src/config/subscription-lookup-keys.ts` (new - constants only)

### **Files That Still Need Stripe Keys:**

- ✅ `src/lib/integrations/stripe/client.ts` (uses STRIPE_SECRET_KEY)
- ✅ `src/app/api/webhooks/stripe/route.ts` (uses STRIPE_WEBHOOK_SECRET)
- ✅ All Stripe checkout/payment flows

---

**Status:** ✅ Optional Cleanup  
**Impact:** None on functionality  
**Recommendation:** Clean up during next deployment
