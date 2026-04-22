# WorkOS-Stripe Integration: Quick Answer

**Question:** Can we use WorkOS-Stripe for payment intents or expert payouts?

---

## ⚡ Quick Answer

**NO for payments, YES for subscriptions!**

### ❌ WorkOS-Stripe Does NOT Handle:
1. **Appointment Payments** (Patient → Expert)
   - Keep: `create-payment-intent/route.ts`
   - Keep: Payment Intent creation
   - Keep: Your entire current payment flow

2. **Expert Payouts** (Platform → Expert)
   - Keep: Stripe Connect
   - Keep: Connected accounts
   - Keep: Payout schedules

### ✅ WorkOS-Stripe IS PERFECT For:
1. **Expert Subscriptions** (Expert → Platform)
   - Community: €25/month
   - Top: €59/month
   - **Automatic tier in JWT** (no DB queries!)
   - **Instant permission checks**

2. **Clinic Billing** (Clinic → Platform) 🔮 Phase 2
   - Usage-based pricing per practitioner
   - Automatic seat count sync
   - Real-time billing updates

---

## 🎯 What You Should Use It For

### Perfect Use Case: Subscription Tiers

**BEFORE (Current):**
```typescript
// ❌ Need DB query every time
async function canAccessAnalytics(userId: string) {
  const user = await db.query.UsersTable.findFirst(...); // DB query
  const subscription = await stripe.subscriptions.retrieve(...); // Stripe API
  return subscription.status === 'active' && tier === 'top';
}
```

**AFTER (With WorkOS Entitlements):**
```typescript
// ✅ Just check JWT (instant!)
async function canAccessAnalytics(userId: string) {
  const { user } = await withAuth();
  return user.entitlements?.includes('analytics_access'); // JWT claim
}
```

**Benefits:**
- ✅ Zero database queries
- ✅ Zero Stripe API calls
- ✅ Instant permission checks
- ✅ Automatic updates on subscription change
- ✅ Works offline (JWT cached)

---

## 📊 Your Payment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 ELEVA CARE PAYMENTS                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. APPOINTMENT PAYMENTS (Patient → Expert)            │
│     ✅ KEEP: create-payment-intent route               │
│     ✅ KEEP: Stripe Connect                            │
│     ✅ KEEP: Platform fees                             │
│                                                         │
│  2. EXPERT PAYOUTS (Platform → Expert)                 │
│     ✅ KEEP: Connected accounts                        │
│     ✅ KEEP: Automatic payouts                         │
│                                                         │
│  3. EXPERT SUBSCRIPTIONS (Expert → Platform) 🆕       │
│     ✅ NEW: Use WorkOS Stripe Entitlements            │
│     • Community/Top tier subscriptions                 │
│     • Automatic role in JWT                            │
│     • No DB queries for permissions                    │
│                                                         │
│  4. CLINIC SUBSCRIPTIONS (Clinic → Platform) 🔮       │
│     ✅ NEW: Use WorkOS Stripe Seat Sync (Phase 2)     │
│     • Usage-based billing per seat                     │
│     • Automatic meter events                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Implement (3 Steps)

### Step 1: Connect WorkOS to Stripe (5 minutes)
```
1. Go to WorkOS Dashboard → Authentication → Add-ons
2. Enable "Stripe Add-on"
3. Check "Use Stripe entitlements"
4. Authorize Stripe connection
```

### Step 2: Configure Stripe Products (10 minutes)
```
In Stripe Dashboard, add features to products:

Expert Community Product:
  ✓ appointments_manage
  ✓ events_create
  ✓ calendar_integration

Expert Top Product:
  ✓ All Community features
  ✓ analytics_access       ← Exclusive
  ✓ custom_branding        ← Exclusive
```

### Step 3: Link Customers (Code)
```typescript
// When expert subscribes, link to WorkOS
await workos.organizations.updateOrganization({
  organization: orgId,
  stripe_customer_id: stripeCustomerId,
});

// Entitlements automatically appear in JWT!
```

---

## 🎯 Example: Checking Analytics Access

### Before (DB Query)
```typescript
// app/(private)/analytics/page.tsx
export default async function AnalyticsPage() {
  const { user } = await withAuth();
  
  // ❌ DB query
  const dbUser = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, user.id),
  });
  
  // ❌ Check subscription in DB or Stripe
  if (dbUser.subscriptionTier !== 'top') {
    redirect('/billing/upgrade');
  }
  
  return <Analytics />;
}
```

### After (JWT Check)
```typescript
// app/(private)/analytics/page.tsx
export default async function AnalyticsPage() {
  const { user } = await withAuth();
  
  // ✅ Just check JWT (instant!)
  if (!user.entitlements?.includes('analytics_access')) {
    redirect('/billing/upgrade');
  }
  
  return <Analytics />;
}
```

---

## 💡 Key Insight

**WorkOS-Stripe integration is for SUBSCRIPTIONS, not TRANSACTIONS.**

- ✅ **Use it for:** Expert tier management (Community/Top)
- ✅ **Use it for:** Clinic seat-based billing (Phase 2)
- ❌ **Don't use for:** Patient appointment payments
- ❌ **Don't use for:** Expert payout transfers

**Your current `create-payment-intent` system is perfect for appointment payments!**

---

## 📈 Benefits at a Glance

| Metric | Before | After (WorkOS Entitlements) |
|--------|--------|----------------------------|
| Permission check time | ~50ms (DB query) | <1ms (JWT check) |
| API calls per check | 2 (DB + Stripe) | 0 (JWT only) |
| Database load | 1 query per check | 0 queries |
| Subscription updates | Manual webhooks | Automatic |
| Role changes | Requires re-auth | Immediate in JWT |

---

## 🎉 Bottom Line

**YES, use WorkOS-Stripe, but ONLY for subscriptions:**

1. ✅ **Expert Community/Top tiers** → WorkOS Entitlements
2. ✅ **Clinic seat billing** (Phase 2) → WorkOS Seat Sync
3. ❌ **Appointment payments** → Keep current system
4. ❌ **Expert payouts** → Keep Stripe Connect

**Result:** Zero DB queries for permission checks + Automatic subscription management! 🚀

---

**See full guide:** `WORKOS-STRIPE-INTEGRATION-GUIDE.md`  
**Created:** November 13, 2025  
**Status:** Ready to implement

