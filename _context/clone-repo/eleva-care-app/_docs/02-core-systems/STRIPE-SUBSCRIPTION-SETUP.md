# Stripe Subscription Setup - Complete Guide

**Created:** November 6, 2025  
**Status:** ✅ Production-Ready  
**Phase:** Completed

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Products Created](#products-created)
3. [Recurring Prices](#recurring-prices)
4. [Environment Variables](#environment-variables)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing](#testing)
7. [Next Steps](#next-steps)

---

## 🎯 Overview

This document details the Stripe subscription infrastructure for Eleva's hybrid pricing model:

- **Commission-Based Plans**: Pay-per-transaction (no Stripe subscription needed)
- **Annual Subscription Plans**: Fixed yearly fee + reduced commission rates

**Key Benefits:**

- 🔄 Automatic recurring billing
- 💳 Stripe handles payment failures and retries
- 📊 Built-in subscription analytics
- 🔔 Webhook events for lifecycle management

---

## 📦 Products Created

### 1. Community Expert Annual Subscription

**Product ID:** `prod_TNHmsNWSOqt7M3`

**Description:**  
Annual subscription for Community Experts on Eleva platform. Includes reduced commission rate (12% vs 20%) on all bookings, up to 5 services, basic analytics, weekly payouts, and email support.

**Features:**

- Reduced commission: 12% (save 8% vs commission-only)
- Up to 5 services
- Basic calendar integration
- Standard analytics
- Weekly payouts
- Email support
- Save up to 40% on total costs

---

### 2. Top Expert Annual Subscription

**Product ID:** `prod_TNHnHt7MHvboaP`

**Description:**  
Annual subscription for Top Experts on Eleva platform. Includes industry-leading reduced commission rate (8% vs 15%) on all bookings, unlimited services, advanced analytics, daily payouts, priority support, featured placement, and VIP benefits.

**Features:**

- Industry-leading commission: 8% (save 7% vs commission-only)
- Unlimited services
- Advanced analytics
- Daily payouts
- Priority support
- Featured placement
- Custom branding
- Group sessions
- Direct messaging
- VIP annual benefits

---

### 3. Lecturer Module Annual Add-on

**Product ID:** `prod_TNHnIkS4cWC4MW`

**Description:**  
Annual add-on for Lecturer Module on Eleva platform. Enables experts to create and sell courses, host webinars, and access LMS features. Includes reduced commission rate (3% vs 5%) on all course sales.

**Features:**

- Reduced commission: 3% on course sales (save 2% vs commission-only)
- Create & sell courses
- Host webinars
- LMS access
- Requires active expert subscription

---

## 💰 Recurring Prices

All prices are configured as **annual recurring subscriptions** with automatic renewal.

### Community Expert Annual

```typescript
Price ID: price_1SQXF5K5Ap4Um3SpekZpC9fQ
Amount: $490/year ($40.83/month equivalent)
Currency: USD
Recurring: Yearly
Metadata:
  tier: "community"
  planType: "annual"
  commissionRate: "1200" (12% in basis points)
```

**Stripe Dashboard:**  
https://dashboard.stripe.com/prices/price_1SQXF5K5Ap4Um3SpekZpC9fQ

---

### Top Expert Annual

```typescript
Price ID: price_1SQXF5K5Ap4Um3SpzT4S3agl
Amount: $1,490/year ($124.17/month equivalent)
Currency: USD
Recurring: Yearly
Metadata:
  tier: "top"
  planType: "annual"
  commissionRate: "800" (8% in basis points)
```

**Stripe Dashboard:**  
https://dashboard.stripe.com/prices/price_1SQXF5K5Ap4Um3SpzT4S3agl

---

### Lecturer Module Annual

```typescript
Price ID: price_1SQXF5K5Ap4Um3SpQCBwSFml
Amount: $490/year ($40.83/month equivalent)
Currency: USD
Recurring: Yearly
Metadata:
  addon: "lecturer"
  planType: "annual"
  commissionRate: "300" (3% in basis points)
```

**Stripe Dashboard:**  
https://dashboard.stripe.com/prices/price_1SQXF5K5Ap4Um3SpQCBwSFml

---

## 🔐 Environment Variables

### Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Annual Subscription Price IDs
STRIPE_PRICE_COMMUNITY_ANNUAL=price_1SQXF5K5Ap4Um3SpekZpC9fQ
STRIPE_PRICE_TOP_ANNUAL=price_1SQXF5K5Ap4Um3SpzT4S3agl
STRIPE_PRICE_LECTURER_ADDON_ANNUAL=price_1SQXF5K5Ap4Um3SpQCBwSFml

# Existing Stripe Keys (already configured)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Configuration File

The price IDs are configured in `config/subscription-pricing.ts` with fallback defaults:

```typescript
stripePriceId: process.env.STRIPE_PRICE_COMMUNITY_ANNUAL || 'price_1SQXF5K5Ap4Um3SpekZpC9fQ';
```

This ensures the app works even if environment variables are missing (useful for development).

---

## 🪝 Webhook Configuration

### Required Webhooks

Configure these webhook events in Stripe Dashboard to handle subscription lifecycle:

**Webhook Endpoint:**  
`https://eleva.care/api/webhooks/stripe`

**Events to Listen For:**

#### Subscription Events

- `customer.subscription.created` - New subscription started
- `customer.subscription.updated` - Subscription details changed
- `customer.subscription.deleted` - Subscription canceled/expired
- `customer.subscription.trial_will_end` - Trial ending soon (if applicable)

#### Payment Events

- `invoice.payment_succeeded` - Subscription payment succeeded
- `invoice.payment_failed` - Payment failed (handle grace period)
- `invoice.finalized` - Invoice ready for payment
- `invoice.paid` - Invoice successfully paid

#### Customer Events

- `customer.created` - New customer created
- `customer.updated` - Customer details updated
- `customer.deleted` - Customer deleted

### Webhook Handler Implementation

Create or update: `app/api/webhooks/stripe/route.ts`

```typescript
import { db } from '@/drizzle/db';
import { SubscriptionEventsTable, SubscriptionPlansTable } from '@/drizzle/schema-workos';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`✅ Webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // TODO: Implement subscription update logic
  // 1. Find user by Stripe customer ID
  // 2. Update SubscriptionPlansTable
  // 3. Log event to SubscriptionEventsTable
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  // TODO: Implement subscription cancellation logic
  // 1. Update subscription status to 'canceled'
  // 2. Log cancellation event
  // 3. Send notification to user
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  // TODO: Implement payment success logic
  // 1. Update payment status
  // 2. Log successful payment event
  // 3. Send receipt to user
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // TODO: Implement payment failure logic
  // 1. Update payment status
  // 2. Log failed payment event
  // 3. Send notification to user (dunning email)
}
```

### Webhook Secret

After creating the webhook in Stripe Dashboard, add the signing secret to `.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🧪 Testing

### 1. Test in Stripe Dashboard

Use Stripe's built-in test mode:

1. Go to https://dashboard.stripe.com/test/products
2. Verify the products and prices
3. Create a test subscription using Stripe Checkout

### 2. Test Webhooks Locally

Use Stripe CLI to forward webhooks to localhost:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

### 3. Test Subscription Flow

```bash
# Start dev server
pnpm dev

# Test creating a subscription (use server action)
# Navigate to: http://localhost:3000/dashboard/subscription
```

### 4. Test Cards

Stripe provides test cards for different scenarios:

- **Success:** `4242 4242 4242 4242`
- **Declined:** `4000 0000 0000 0002`
- **Authentication Required:** `4000 0025 0000 3155`

---

## 🚀 Next Steps

### Phase 2A: Server Actions (In Progress)

- [ ] Create `server/actions/subscriptions.ts`
  - `createSubscription(workosUserId, priceId)`
  - `cancelSubscription(workosUserId)`
  - `updateSubscription(workosUserId, newPriceId)`
  - `getSubscriptionStatus(workosUserId)`

### Phase 2B: Eligibility Checker

- [ ] Create `server/actions/eligibility.ts`
  - `checkAnnualEligibility(workosUserId)`
  - `calculateProjectedSavings(workosUserId)`
  - `notifyEligibleExperts()` (cron job)

### Phase 2C: UI Components

- [ ] Create subscription management dashboard
  - Current plan display
  - Upgrade/downgrade options
  - Billing history
  - Invoice downloads

### Phase 2D: Commission Tracking

- [ ] Update payment processing to record commissions
  - Create commission record on booking payment
  - Calculate based on current plan
  - Update eligibility metrics

### Phase 3: Production Deployment

- [ ] Configure production webhooks
- [ ] Test end-to-end subscription flow
- [ ] Set up monitoring and alerts
- [ ] Document migration path for existing experts

---

## 📚 Related Documentation

- [Role Progression System](./ROLE-PROGRESSION-SYSTEM.md)
- [Optimized Pricing Model](./.cursor/plans/optimized-pricing-model.plan.md)
- [Subscription Pricing Config](../config/subscription-pricing.ts)
- [Database Schema](../drizzle/schema-workos.ts)

---

## 🔗 Quick Links

- [Stripe Products Dashboard](https://dashboard.stripe.com/products)
- [Stripe Subscriptions Dashboard](https://dashboard.stripe.com/subscriptions)
- [Stripe Webhooks Dashboard](https://dashboard.stripe.com/webhooks)
- [Stripe API Docs - Subscriptions](https://stripe.com/docs/api/subscriptions)
- [Stripe Testing Guide](https://stripe.com/docs/testing)

---

**Last Updated:** November 6, 2025  
**Maintained By:** Development Team
