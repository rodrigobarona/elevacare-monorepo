# Stripe Lookup Keys + Database Architecture

**Date:** November 13, 2025  
**Status:** ✅ Production-Ready Architecture  
**Review:** Stripe Best Practices + WorkOS Integration

---

## 🎯 Executive Summary

**Current Database Schema: ✅ CORRECT**

Your database schema (`schema-workos.ts`) is **already following industry best practices** by storing **actual Stripe price IDs**, not lookup keys. Lookup keys are used **in application code** for human-readable references and dynamic resolution.

---

## 🏗️ Architecture Overview

### **Industry Standard Pattern (Stripe + WorkOS)**

```
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  (Human-readable lookup keys for developers)                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Code: 'community-expert-monthly'                           │
│         ↓                                                   │
│  Price Resolver (with caching)                              │
│         ↓                                                   │
│  Stripe API: price_1SQbV5K5Ap4Um3SpD65qOwZB                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                            │
│  (Actual Stripe price IDs for performance & history)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  subscription_plans.stripe_price_id:                        │
│    'price_1SQbV5K5Ap4Um3SpD65qOwZB'                         │
│                                                             │
│  events.stripe_price_id:                                    │
│    'price_1NOhvg2eZvKYlo2CqkpQDVRT'                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Current Database Schema Analysis

### **1. Subscription Plans Table** ✅ **PERFECT**

```typescript:drizzle/schema-workos.ts
export const SubscriptionPlansTable = pgTable('subscription_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().unique(),
  
  // ✅ CORRECT: Stores actual Stripe price ID
  stripePriceId: text('stripe_price_id'), 
  
  // Other fields...
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeCustomerId: text('stripe_customer_id'),
  billingInterval: text('billing_interval').$type<'month' | 'year'>(),
  monthlyFee: integer('monthly_fee'), // in cents
  annualFee: integer('annual_fee'), // in cents
});
```

**Why this is correct:**
- Stores resolved Stripe price ID (`price_xxx`)
- Works with Stripe webhooks (which use price IDs, not lookup keys)
- Historical accuracy (exact price used at subscription time)
- Fast queries (no resolution needed when reading)
- Works offline (no API dependency for data retrieval)

---

### **2. Events Table (Bookable Services)** ✅ **PERFECT**

```typescript:drizzle/schema-workos.ts
export const EventsTable = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id'),
  workosUserId: text('workos_user_id').notNull(),
  
  // ✅ CORRECT: Stores actual Stripe product/price IDs
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id'),
  
  price: integer('price').notNull().default(0), // in cents
  currency: text('currency').notNull().default('eur'),
});
```

**Why this is correct:**
- Stores actual Stripe IDs for payment processing
- Used in checkout sessions and payment intents
- Denormalized for performance (no API calls during checkout)

---

### **3. Transaction Commissions Table** ✅ **PERFECT**

```typescript:drizzle/schema-workos.ts
export const TransactionCommissionsTable = pgTable('transaction_commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Historical snapshot at transaction time
  planTypeAtTransaction: text('plan_type_at_transaction').$type<'commission' | 'monthly' | 'annual'>(),
  tierLevelAtTransaction: text('tier_level_at_transaction').$type<'community' | 'top'>(),
  
  // Actual amounts charged
  commissionRate: integer('commission_rate').notNull(),
  commissionAmount: integer('commission_amount').notNull(),
  
  // ✅ CORRECT: References actual Stripe IDs
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId: text('stripe_transfer_id'),
});
```

**Why this is correct:**
- Immutable historical record
- Stores actual rates and IDs used at transaction time
- Audit trail for financial reporting

---

## 🚨 Current State: Lookup Keys Missing

### **Problem Discovered:**

Your existing Stripe prices **do not have lookup keys assigned**:

```json
{
  "id": "price_1SQbV5K5Ap4Um3SpD65qOwZB",
  "lookup_key": null,  // ❌ MISSING
  "metadata": {
    "tier": "community",
    "planType": "monthly",
    "commissionRate": "1200"
  }
}
```

---

## 🔧 Solution: Add Lookup Keys to Existing Prices

### **Step 1: Run Migration Script**

```bash
pnpm tsx scripts/utilities/add-lookup-keys-to-prices.ts
```

**What it does:**
- Adds lookup keys to 5 existing prices
- Maps existing price IDs to human-readable keys
- Verifies lookup key assignment
- Safe to run multiple times (idempotent)

**Mapping:**
```typescript
const PRICE_LOOKUP_KEY_MAP = {
  'price_1SQbV5K5Ap4Um3SpD65qOwZB': 'community-expert-monthly',
  'price_1SQXF5K5Ap4Um3SpekZpC9fQ': 'community-expert-annual',
  'price_1SQbV6K5Ap4Um3SpwFKRCoJo': 'top-expert-monthly',
  'price_1SQXF5K5Ap4Um3SpzT4S3agl': 'top-expert-annual',
  'price_1SQXF5K5Ap4Um3SpQCBwSFml': 'lecturer-module-annual',
};
```

---

### **Step 2: Verify Lookup Keys**

```bash
# Check each lookup key
stripe prices list --lookup-keys "community-expert-monthly"
stripe prices list --lookup-keys "top-expert-monthly"
stripe prices list --lookup-keys "community-expert-annual"
stripe prices list --lookup-keys "top-expert-annual"
stripe prices list --lookup-keys "lecturer-module-annual"
```

**Expected output:**
- Each command returns 1 price
- Price is active
- Amount matches expected value

---

## 📊 Data Flow Architecture

### **Subscription Creation Flow:**

```typescript
// 1. User selects plan in UI
const tierLevel = 'community'; // or 'top'
const interval = 'monthly'; // or 'annual'

// 2. Application resolves lookup key to price ID
import { EXPERT_LOOKUP_KEYS } from '@/config/subscription-lookup-keys';
import { getPriceIdByLookupKey } from '@/lib/stripe/price-resolver';

const lookupKey = EXPERT_LOOKUP_KEYS[tierLevel][interval]; 
// → 'community-expert-monthly'

const stripePriceId = await getPriceIdByLookupKey(lookupKey);
// → 'price_1SQbV5K5Ap4Um3SpD65qOwZB'

// 3. Create Stripe checkout session with resolved price ID
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'subscription',
  line_items: [{ price: stripePriceId, quantity: 1 }], // ← Actual ID
  // ...
});

// 4. Store resolved price ID in database
await db.insert(SubscriptionPlansTable).values({
  orgId: membership.orgId,
  stripePriceId, // ← Store actual Stripe ID
  billingInterval: interval,
  tierLevel,
  // ...
});
```

---

### **Stripe Webhook Processing:**

```typescript
// Stripe sends webhooks with actual price IDs, NOT lookup keys
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ['line_items', 'subscription'],
});

const subscription = session.subscription as Stripe.Subscription;
const priceId = subscription.items.data[0].price.id;
// → 'price_1SQbV5K5Ap4Um3SpD65qOwZB' (Actual ID)

// Update database with actual price ID
await db.update(SubscriptionPlansTable)
  .set({ 
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId, // ← Store actual ID from webhook
    subscriptionStatus: 'active',
  })
  .where(eq(SubscriptionPlansTable.orgId, orgId));
```

**Why webhooks use price IDs, not lookup keys:**
- Webhooks are event-driven notifications from Stripe
- Stripe doesn't know about your lookup keys (they're application-specific)
- Price IDs are the source of truth in Stripe's system

---

## 🔄 WorkOS Integration Strategy

### **Current State: WorkOS Vault (✅ Implemented)**

You're already using WorkOS Vault for sensitive data encryption:

```typescript:drizzle/schema-workos.ts
export const RecordsTable = pgTable('records', {
  // WorkOS Vault encrypted content (org-scoped)
  vaultEncryptedContent: text('vault_encrypted_content').notNull(),
  vaultEncryptedMetadata: text('vault_encrypted_metadata'),
  encryptionMethod: text('encryption_method').notNull().default('vault'),
});

export const UsersTable = pgTable('users', {
  // Google OAuth tokens encrypted with WorkOS Vault
  vaultGoogleAccessToken: text('vault_google_access_token'),
  vaultGoogleRefreshToken: text('vault_google_refresh_token'),
  googleTokenEncryptionMethod: text('google_token_encryption_method').default('vault'),
});
```

**Usage:**
- Medical records (PHI): ✅ Encrypted with WorkOS Vault
- Google OAuth tokens: ✅ Encrypted with WorkOS Vault
- Org-scoped key isolation: ✅ Implemented
- Automatic audit logging: ✅ Implemented

---

### **Future Enhancement: WorkOS-Stripe Integration** 🔮

WorkOS has a **Stripe integration** for subscription management that could enhance your architecture:

#### **Benefits:**

1. **JWT-Based Entitlements** (Zero DB Queries)
   ```typescript
   // BEFORE: Need DB query + Stripe API call
   const subscription = await db.query.SubscriptionPlansTable.findFirst(...);
   const isActive = subscription?.subscriptionStatus === 'active';
   
   // AFTER: Just check JWT (instant!)
   const { user } = await withAuth();
   const canAccess = user.entitlements?.includes('analytics_access');
   ```

2. **Automatic Tier Updates**
   - Subscription change → WorkOS webhook → JWT updated
   - No manual database syncing needed
   - Real-time permission updates

3. **Audit Logs Integration**
   - Subscription changes logged to WorkOS Audit Logs
   - Unified audit trail across WorkOS + Stripe events
   - HIPAA-compliant event tracking

#### **Implementation Strategy:**

```typescript
// Phase 1: Current (Lookup Keys) ✅
// - Application code uses lookup keys
// - Database stores Stripe price IDs
// - Price resolver with caching

// Phase 2: WorkOS-Stripe Integration (Future) 🔮
// - WorkOS manages subscription → tier mapping
// - JWT includes entitlements
// - Stripe webhook → WorkOS → JWT update
// - Database still stores price IDs for historical accuracy
```

**Recommendation:** Implement lookup keys now (Phase 1), then evaluate WorkOS-Stripe integration in Q2 2025 after you have more active subscriptions and need faster permission checks.

---

## 📋 Best Practices Checklist

### **✅ Database Design:**
- [x] Store actual Stripe price IDs (not lookup keys)
- [x] Include `stripePriceId` in subscription plans
- [x] Include `stripeProductId` and `stripePriceId` in events
- [x] Historical snapshot fields in transaction commissions
- [x] Org-scoped data with RLS

### **✅ Application Code:**
- [x] Use lookup keys in configuration (`subscription-lookup-keys.ts`)
- [x] Implement price resolver with caching (`price-resolver.ts`)
- [x] Resolve lookup keys before Stripe API calls
- [x] Store resolved price IDs in database

### **✅ Stripe Configuration:**
- [ ] Add lookup keys to existing prices (via migration script)
- [ ] Test lookup key resolution
- [ ] Verify webhook processing with price IDs

### **✅ WorkOS Integration:**
- [x] WorkOS Vault for sensitive data (PHI, OAuth tokens)
- [x] Org-scoped encryption
- [x] Audit logging
- [ ] Future: WorkOS-Stripe for JWT-based entitlements

---

## 🚀 Deployment Checklist

### **Pre-Deployment:**

1. **Add Lookup Keys to Existing Prices:**
   ```bash
   pnpm tsx scripts/utilities/add-lookup-keys-to-prices.ts
   ```

2. **Verify Lookup Keys:**
   ```bash
   stripe prices list --lookup-keys "community-expert-monthly"
   stripe prices list --lookup-keys "top-expert-monthly"
   # ... verify all 5 lookup keys
   ```

3. **Test Price Resolution:**
   ```typescript
   import { resolvePriceByLookupKey } from '@/lib/stripe/price-resolver';
   
   const price = await resolvePriceByLookupKey('community-expert-monthly');
   console.log(price?.id); // Should print: price_1SQbV5K5Ap4Um3SpD65qOwZB
   console.log(price?.unit_amount); // Should print: 4900
   ```

4. **Test Subscription Flow:**
   - Navigate to `/dashboard/subscription`
   - Click "Upgrade to Annual Plan"
   - Verify checkout session created with correct price ID
   - Complete payment
   - Check database: `stripePriceId` stored correctly

5. **Test Webhook Processing:**
   - Use Stripe CLI to send test webhook:
     ```bash
     stripe trigger checkout.session.completed
     ```
   - Verify database updated with actual price ID
   - Check logs for any errors

---

### **Post-Deployment Monitoring:**

1. **Check Cache Performance:**
   ```typescript
   import { getCacheStats } from '@/lib/stripe/price-resolver';
   console.log(getCacheStats());
   // Should show high cache hit rate after warm-up
   ```

2. **Monitor API Call Volume:**
   - Track Stripe API calls to `/v1/prices`
   - Should be minimal after cache warm-up (5-min TTL)
   - Alert if excessive API calls (indicates cache issues)

3. **Verify Historical Accuracy:**
   ```sql
   -- Check that all subscriptions have actual price IDs stored
   SELECT 
     stripe_price_id,
     COUNT(*) 
   FROM subscription_plans 
   WHERE stripe_price_id IS NOT NULL 
   GROUP BY stripe_price_id;
   ```

4. **Audit Webhook Processing:**
   ```sql
   -- Check subscription events
   SELECT 
     event_type,
     new_plan_type,
     created_at 
   FROM subscription_events 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## 🎯 Recommendations

### **Immediate (Week 1):**

1. ✅ **Database Schema: No changes needed** - Already correct
2. ✅ **Application Code: Lookup keys implemented** - Ready to use
3. ⚠️ **Stripe Prices: Add lookup keys** - Run migration script
4. ✅ **Price Resolver: Implemented with caching** - Production-ready

### **Short-Term (Month 1):**

1. **Create Partner Workspace Prices:**
   - Use `/admin/subscriptions` to create new prices
   - Add lookup keys: `partner-starter-monthly`, `partner-professional-monthly`, etc.
   - Test partner signup flow

2. **Monitor Performance:**
   - Track cache hit rate (should be >95%)
   - Monitor Stripe API usage (should be <10 calls/day)
   - Check database query performance

3. **Document Price Management:**
   - Create runbook for adding new prices
   - Document lookup key naming conventions
   - Train admin users on `/admin/subscriptions` interface

### **Long-Term (Q2 2025):**

1. **Evaluate WorkOS-Stripe Integration:**
   - Review WorkOS-Stripe documentation
   - Assess benefit of JWT-based entitlements
   - Plan migration if beneficial (high subscription volume)

2. **Regional Pricing:**
   - Add currency to lookup key format
   - Example: `community-expert-monthly-eur`, `community-expert-monthly-usd`
   - Resolve based on user country

3. **A/B Testing:**
   - Create alternate prices with different lookup keys
   - Example: `community-expert-monthly-v2`
   - Switch between them without code changes

---

## 📚 Reference Documentation

### **Internal Docs:**
- `_docs/LOOKUP-KEYS-MIGRATION.md` - Comprehensive migration guide
- `_docs/LOOKUP-KEYS-IMPLEMENTATION-SUMMARY.md` - Implementation details
- `_docs/STRIPE-PRICING-REVIEW.md` - Current Stripe pricing audit
- `_docs/_WorkOS Vault implemenation/` - WorkOS Vault integration docs

### **Code Files:**
- `src/config/subscription-lookup-keys.ts` - Lookup key constants
- `src/lib/stripe/price-resolver.ts` - Price resolution with caching
- `src/config/subscription-pricing-v2.ts` - Pricing configuration
- `drizzle/schema-workos.ts` - Database schema (lines 883-945)

### **External References:**
- Stripe Lookup Keys: https://docs.stripe.com/products-prices/manage-prices#lookup-keys
- WorkOS Vault: https://workos.com/docs/vault
- WorkOS-Stripe: https://workos.com/docs/integrations/stripe (Future)

---

## ✅ Final Verdict

**Your database schema is production-ready and follows industry best practices.**

**Action Required:**
1. Add lookup keys to existing Stripe prices (5 minutes)
2. Test lookup key resolution (5 minutes)
3. Deploy application code (already implemented)
4. Monitor for 24-48 hours

**No database schema changes needed!** 🎉

---

**Document Version:** 1.0  
**Status:** ✅ Approved for Production  
**Review Date:** November 13, 2025  
**Next Review:** Q2 2025 (WorkOS-Stripe evaluation)

