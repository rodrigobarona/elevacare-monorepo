# WorkOS-Stripe Integration: Complete Implementation Guide

**Version:** 1.0  
**Date:** November 13, 2025  
**Status:** Production-Ready Architecture

---

## 🎯 Executive Summary

WorkOS provides **two powerful Stripe integrations** that perfectly complement your payment system:

1. **✅ Stripe Entitlements** - Automatic subscription-based role management
2. **✅ Stripe Seat Sync** - Automatic usage-based billing for clinics (Phase 2)

**Important:** WorkOS-Stripe handles **subscriptions** (Expert tiers), NOT appointment payments (patient → expert). Your existing `create-payment-intent` route remains unchanged.

---

## 📊 Payment Architecture Overview

### Your Current Payment System

```
┌─────────────────────────────────────────────────────────────┐
│                    ELEVA CARE PAYMENTS                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. APPOINTMENT PAYMENTS (Patient → Expert)                  │
│     ✅ KEEP AS-IS (create-payment-intent route)              │
│     • Patient books appointment                               │
│     • Payment Intent created                                  │
│     • Platform fee (8-20% commission)                         │
│     • Stripe Connect for payouts                              │
│                                                                │
│  2. EXPERT PAYOUTS (Platform → Expert)                       │
│     ✅ KEEP AS-IS (Stripe Connect)                           │
│     • Automatic payouts to experts                            │
│     • Transfer schedule configured                            │
│     • Connected accounts managed                              │
│                                                                │
├─────────────────────────────────────────────────────────────┤
│  3. EXPERT SUBSCRIPTIONS (Expert → Platform) 🆕              │
│     ✅ USE WORKOS-STRIPE ENTITLEMENTS                        │
│     • Community: €25/month or €240/year                      │
│     • Top: €59/month or €590/year                            │
│     • Automatic role updates in JWT                           │
│     • No DB queries needed                                    │
│                                                                │
│  4. CLINIC SUBSCRIPTIONS (Clinic → Platform) 🔮 Phase 2      │
│     ✅ USE WORKOS STRIPE SEAT SYNC                           │
│     • Pay per practitioner (€X per member)                   │
│     • Automatic billing meter updates                         │
│     • Usage-based pricing                                     │
│                                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Use Case 1: Stripe Entitlements (Expert Subscriptions)

### What It Does

Automatically includes subscription tier information in the WorkOS JWT, eliminating the need for database queries to check subscription status.

### Before (Without WorkOS Entitlements)

```typescript
// ❌ OLD: Need to query DB to check subscription
async function canAccessAnalytics(userId: string): Promise<boolean> {
  // 1. Query user from DB
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, userId),
  });

  // 2. Check subscription status in Stripe
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

  // 3. Check if subscription is active and tier is "top"
  return subscription.status === 'active' && subscription.metadata.tier === 'top';
}
```

### After (With WorkOS Entitlements)

```typescript
// ✅ NEW: Check JWT directly (no DB query!)
async function canAccessAnalytics(userId: string): Promise<boolean> {
  const { user } = await withAuth();

  // JWT automatically contains: { entitlements: ['analytics_access', 'custom_branding'] }
  return user.entitlements?.includes('analytics_access') || false;
}
```

**Benefits:**

- ✅ No database queries
- ✅ No Stripe API calls
- ✅ Instant permission checks
- ✅ Automatic updates when subscription changes
- ✅ Works offline (JWT is cached)

---

## 🛠️ Implementation: Stripe Entitlements

### Step 1: Connect WorkOS to Stripe

1. Go to [WorkOS Dashboard](https://dashboard.workos.com) → **Authentication** → **Add-ons**
2. Enable **Stripe Add-on**
3. Select **"Use Stripe entitlements"**
4. Authorize the connection to your Stripe account

### Step 2: Configure Stripe Products with Lookup Keys

In **Stripe Dashboard**, add entitlement lookup keys to your products:

#### Expert Community Product

```
Product: Expert Community Tier
Price ID: price_community_monthly (€25/month)
Price ID: price_community_annual (€240/year)

Metadata (add to product):
  lookup_key: expert_community

Features (add to product in Stripe):
  ✓ appointments_manage
  ✓ events_create
  ✓ availability_manage
  ✓ calendar_integration
  ✓ profile_expert
```

#### Expert Top Product

```
Product: Expert Top Tier
Price ID: price_top_monthly (€59/month)
Price ID: price_top_annual (€590/year)

Metadata (add to product):
  lookup_key: expert_top

Features (add to product in Stripe):
  ✓ appointments_manage
  ✓ events_create
  ✓ availability_manage
  ✓ calendar_integration
  ✓ profile_expert
  ✓ analytics_access        ← Top tier exclusive
  ✓ custom_branding         ← Top tier exclusive
  ✓ advanced_reporting      ← Top tier exclusive
```

### Step 3: Set Stripe Customer ID on WorkOS Organizations

When an expert subscribes, link their Stripe customer to their WorkOS organization:

```typescript
// lib/integrations/workos/stripe-entitlements.ts
import { workos } from '@workos-inc/node';

/**
 * Link Stripe customer to WorkOS organization
 * Call this when expert completes subscription
 */
export async function linkStripeCustomerToOrg(
  workosUserId: string,
  stripeCustomerId: string,
): Promise<void> {
  // Get user's personal organization
  const org = await db.query.OrganizationsTable.findFirst({
    where: eq(OrganizationsTable.ownerId, workosUserId),
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Set Stripe customer ID on WorkOS organization
  await workos.organizations.updateOrganization({
    organization: org.workosOrgId,
    stripe_customer_id: stripeCustomerId,
  });

  console.log(`✅ Linked Stripe customer ${stripeCustomerId} to org ${org.workosOrgId}`);
}
```

### Step 4: Create Subscription with Entitlements

When expert subscribes to Community or Top tier:

```typescript
// app/api/subscriptions/create/route.ts
import { linkStripeCustomerToOrg } from '@/lib/integrations/workos/stripe-entitlements';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { user } = await withAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { priceId, tier } = await req.json(); // tier: 'community' or 'top'

  // 1. Get or create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      workos_user_id: user.id,
      workos_org_id: user.organizationId,
    },
  });

  // 2. Create subscription with product that has entitlements
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      tier, // 'community' or 'top'
      workos_user_id: user.id,
    },
  });

  // 3. Link Stripe customer to WorkOS org (enables entitlements in JWT)
  await linkStripeCustomerToOrg(user.id, customer.id);

  // 4. Update user role in WorkOS (triggers JWT refresh)
  await workos.userManagement.updateOrganizationMembership({
    organizationMembershipId: user.organizationMembershipId,
    roleSlug: tier === 'top' ? 'expert_top' : 'expert_community',
  });

  return NextResponse.json({
    subscriptionId: subscription.id,
    clientSecret: (subscription.latest_invoice as Stripe.Invoice).payment_intent?.client_secret,
  });
}
```

### Step 5: Handle Subscription Webhooks

Listen for Stripe webhooks to update entitlements automatically:

```typescript
// app/api/webhooks/stripe/route.ts
import { workos } from '@workos-inc/node';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const workosUserId = subscription.metadata.workos_user_id;
  const tier = subscription.metadata.tier; // 'community' or 'top'

  if (!workosUserId) return;

  // Update role in WorkOS (entitlements automatically update in next JWT)
  const membership = await workos.userManagement.listOrganizationMemberships({
    userId: workosUserId,
  });

  if (membership.data.length > 0) {
    await workos.userManagement.updateOrganizationMembership({
      organizationMembershipId: membership.data[0].id,
      roleSlug: tier === 'top' ? 'expert_top' : 'expert_community',
    });
  }

  console.log(`✅ Updated ${workosUserId} to ${tier} tier - entitlements will reflect in next JWT`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const workosUserId = subscription.metadata.workos_user_id;

  if (!workosUserId) return;

  // Downgrade to patient role
  const membership = await workos.userManagement.listOrganizationMemberships({
    userId: workosUserId,
  });

  if (membership.data.length > 0) {
    await workos.userManagement.updateOrganizationMembership({
      organizationMembershipId: membership.data[0].id,
      roleSlug: 'patient', // Revert to base role
    });
  }

  console.log(`✅ Downgraded ${workosUserId} to patient - subscription cancelled`);
}
```

### Step 6: Use Entitlements in Your App

#### Server Components

```typescript
// app/(private)/analytics/page.tsx
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export default async function AnalyticsPage() {
  const { user } = await withAuth();

  // ✅ Check entitlements from JWT (no DB query!)
  if (!user?.entitlements?.includes('analytics_access')) {
    redirect('/billing/subscription?upgrade=top');
  }

  return <AnalyticsDashboard />;
}
```

#### API Routes

```typescript
// app/api/analytics/revenue/route.ts
import { withAuth } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  const { user } = await withAuth();

  // ✅ Check entitlements from JWT
  if (!user?.entitlements?.includes('analytics_access')) {
    return NextResponse.json({ error: 'Analytics access requires Top tier' }, { status: 403 });
  }

  const revenueData = await getRevenueAnalytics(user.id);
  return NextResponse.json(revenueData);
}
```

#### Client Components

```typescript
// components/dashboard/analytics-card.tsx
'use client';

import { useUser } from '@workos-inc/authkit-nextjs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function AnalyticsCard() {
  const { user } = useUser();

  // ✅ Check entitlements from JWT
  const hasAnalytics = user?.entitlements?.includes('analytics_access');

  if (!hasAnalytics) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold mb-2">Advanced Analytics</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Unlock revenue insights, patient demographics, and performance metrics
        </p>
        <Button asChild>
          <a href="/billing/subscription?upgrade=top">Upgrade to Top Tier</a>
        </Button>
      </Card>
    );
  }

  return <AnalyticsCharts />;
}
```

---

## ✅ Use Case 2: Stripe Seat Sync (Clinic Subscriptions) 🔮 Phase 2

### What It Does

Automatically syncs organization member counts to Stripe billing meters for usage-based pricing.

### Perfect For Clinic Billing

```
Clinic Pricing Model:
- Base: €99/month
- Per practitioner: €49/month per active member
- Automatic billing when members join/leave
```

### How It Works

```
1. Clinic Admin invites practitioner
   ↓
2. WorkOS creates organization membership
   ↓
3. WorkOS sends meter event to Stripe: workos_seat_count = 5
   ↓
4. Stripe charges €99 + (5 × €49) = €344/month
   ↓
5. Practitioner leaves
   ↓
6. WorkOS sends meter event: workos_seat_count = 4
   ↓
7. Next month: Stripe charges €99 + (4 × €49) = €295/month
```

### Implementation (Phase 2)

#### Step 1: Enable Seat Sync

```
WorkOS Dashboard → Authentication → Add-ons → Stripe
✓ Sync organization seat counts
```

#### Step 2: Create Stripe Billing Meter Product

```
Stripe Dashboard → Billing → Meters → Create Meter

Name: Clinic Practitioners
Event name: workos_seat_count (auto-created by WorkOS)
Aggregation: last (most recent seat count)
```

#### Step 3: Create Clinic Subscription with Meter

```typescript
// When clinic subscribes
const subscription = await stripe.subscriptions.create({
  customer: clinicStripeCustomerId,
  items: [
    {
      price: 'price_clinic_base', // €99/month base
    },
    {
      price: 'price_per_seat', // €49/month per seat
      billing_meter: 'workos_seat_count', // Auto-populated by WorkOS
    },
  ],
});
```

#### Step 4: WorkOS Handles the Rest

```typescript
// No code needed! WorkOS automatically:
// - Sends meter events when members join/leave
// - Updates seat count in real-time
// - Stripe bills based on latest seat count
```

---

## ❌ What WorkOS-Stripe Does NOT Handle

### 1. Appointment Payments (Patient → Expert)

**Keep your existing system:**

- `app/api/create-payment-intent/route.ts` ✅ Keep as-is
- Stripe Connect for platform fees ✅ Keep as-is
- Payment Intent for bookings ✅ Keep as-is

**Why:** WorkOS-Stripe is for **subscriptions**, not one-time payments.

### 2. Expert Payouts (Platform → Expert)

**Keep your existing system:**

- Stripe Connect payouts ✅ Keep as-is
- Connected accounts ✅ Keep as-is
- Payout schedules ✅ Keep as-is

**Why:** WorkOS doesn't manage Connected Accounts or payouts.

### 3. Patient Payments

**Keep your existing system:**

- Payment methods ✅ Keep as-is
- Invoice generation ✅ Keep as-is
- Refunds ✅ Keep as-is

**Why:** WorkOS is focused on B2B subscriptions, not B2C payments.

---

## 📊 Comparison Table

| Feature                  | Current System            | WorkOS-Stripe        | Recommendation                 |
| ------------------------ | ------------------------- | -------------------- | ------------------------------ |
| **Appointment Payments** | ✅ create-payment-intent  | ❌ Not supported     | ✅ Keep current system         |
| **Platform Commissions** | ✅ application_fee_amount | ❌ Not supported     | ✅ Keep current system         |
| **Expert Payouts**       | ✅ Stripe Connect         | ❌ Not supported     | ✅ Keep current system         |
| **Expert Subscriptions** | Manual                    | ✅ Automatic in JWT  | ✅ **Use WorkOS Entitlements** |
| **Subscription Tiers**   | DB queries                | ✅ Automatic in JWT  | ✅ **Use WorkOS Entitlements** |
| **Role Updates**         | Manual webhooks           | ✅ Automatic sync    | ✅ **Use WorkOS Entitlements** |
| **Clinic Seat Billing**  | Not implemented           | ✅ Auto meter events | ✅ **Use Seat Sync (Phase 2)** |

---

## 🚀 Implementation Roadmap

### Phase 1A: Expert Subscriptions (Week 1-2)

1. ✅ Connect WorkOS to Stripe
2. ✅ Configure Stripe products with entitlements
3. ✅ Update subscription creation flow
4. ✅ Add Stripe webhook handler
5. ✅ Update permission checks to use JWT entitlements
6. ✅ Test subscription upgrades/downgrades

### Phase 1B: Migration (Week 3)

1. ✅ Migrate existing subscriptions to new system
2. ✅ Link existing Stripe customers to WorkOS orgs
3. ✅ Verify entitlements for all users
4. ✅ Monitor for issues

### Phase 2: Clinic Seat Sync (Q1 2026)

1. ✅ Enable Stripe Seat Sync in WorkOS
2. ✅ Create meter-based pricing in Stripe
3. ✅ Test seat count updates
4. ✅ Launch clinic subscriptions

---

## 🔧 Code Structure

### New Files to Create

```
lib/integrations/workos/
├── stripe-entitlements.ts          # Link Stripe customer to WorkOS org
└── subscription-manager.ts          # Create/update subscriptions

app/api/subscriptions/
├── create/route.ts                  # Create new subscription
├── upgrade/route.ts                 # Upgrade tier
├── cancel/route.ts                  # Cancel subscription
└── portal/route.ts                  # Stripe billing portal

app/api/webhooks/stripe/
└── route.ts                         # Handle subscription webhooks (UPDATE EXISTING)
```

### Files to Update

```
app/api/create-payment-intent/route.ts  # NO CHANGES (keep for appointments)
lib/integrations/stripe/index.ts        # Add subscription helpers
types/subscriptions.ts                  # Add entitlement types
```

---

## ✅ Benefits Summary

### Performance

- ✅ **Zero DB queries** for permission checks
- ✅ **Instant role updates** via JWT
- ✅ **Offline-capable** (JWT is cached)
- ✅ **Automatic sync** (no manual updates)

### Developer Experience

- ✅ **Less code** (WorkOS handles sync)
- ✅ **No webhooks to maintain** (WorkOS handles)
- ✅ **Type-safe** (entitlements in JWT)
- ✅ **Easy testing** (mock JWT claims)

### Business

- ✅ **Accurate billing** (usage-based for clinics)
- ✅ **Real-time access** (immediate tier access)
- ✅ **Fraud prevention** (Stripe validates)
- ✅ **Compliance** (PCI handled by Stripe)

---

## 🎯 Decision Matrix

### Use WorkOS-Stripe Entitlements For:

✅ Expert Community → Top tier subscriptions  
✅ Role-based feature access (analytics, branding)  
✅ Subscription tier management  
✅ Feature flags based on plan  
✅ Clinic seat-based billing (Phase 2)

### Keep Current Stripe Integration For:

✅ Appointment payments (Patient → Expert)  
✅ Platform commission/fees  
✅ Expert payouts (Connected Accounts)  
✅ One-time payments  
✅ Refunds and disputes

---

## 📚 Resources

### Documentation

- **WorkOS Stripe Integration:** https://workos.com/docs/stripe
- **Stripe Entitlements:** https://stripe.com/docs/billing/subscriptions/entitlements
- **Stripe Billing Meters:** https://stripe.com/docs/billing/subscriptions/usage-based/meters
- **Your Current Payment System:** `app/api/create-payment-intent/route.ts`

### Support

- 💬 Slack: #dev-platform
- 📧 Email: dev-team@eleva.care
- 🐛 GitHub: Issues with `[stripe-integration]` tag

---

## 🎉 Summary

**WorkOS-Stripe integration is PERFECT for:**

1. ✅ **Expert subscription tiers** (Community vs Top) - Use Entitlements
2. ✅ **Clinic seat-based billing** (Phase 2) - Use Seat Sync
3. ✅ **Automatic role updates** - No more manual DB queries

**Your current system is PERFECT for:**

1. ✅ **Appointment payments** (Patient → Expert)
2. ✅ **Expert payouts** (Stripe Connect)
3. ✅ **Platform commissions** (application_fee)

**Together, they create a complete payment ecosystem!** 🚀

---

**Document Version:** 1.0  
**Created:** November 13, 2025  
**Next Review:** After Phase 1A implementation  
**Status:** ✅ Ready for Implementation
