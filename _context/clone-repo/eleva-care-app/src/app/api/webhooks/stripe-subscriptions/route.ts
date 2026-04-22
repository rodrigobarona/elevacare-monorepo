/**
 * Stripe Subscription Webhook Handler
 *
 * Handles subscription lifecycle events:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - checkout.session.completed (for subscriptions)
 *
 * Flow:
 * 1. Verify webhook signature
 * 2. Process event based on type
 * 3. Update database (SubscriptionPlansTable, SubscriptionEventsTable)
 * 4. Log audit trail
 */
import * as Sentry from '@sentry/nextjs';
import { SUBSCRIPTION_PRICING } from '@/config/subscription-pricing';
import { db } from '@/drizzle/db';
import {
  OrganizationsTable,
  SubscriptionEventsTable,
  SubscriptionPlansTable,
  UserOrgMembershipsTable,
  UsersTable,
} from '@/drizzle/schema';
import { getServerStripe } from '@/lib/integrations/stripe';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const { logger } = Sentry;
const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!;

// ============================================================================
// GET Handler - Webhook Info
// ============================================================================

export async function GET() {
  return NextResponse.json({
    message: 'Stripe Subscription Webhook Endpoint',
    events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'checkout.session.completed',
    ],
  });
}

// ============================================================================
// POST Handler - Process Webhook Events
// ============================================================================

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    logger.error('Missing Stripe signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!webhookSecret) {
    logger.error('Missing STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const stripe = await getServerStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  logger.info(`Webhook received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleCheckoutCompleted(session);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, event.type);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handlePaymentSucceeded(invoice);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handlePaymentFailed(invoice);
        }
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workosUserId = session.metadata?.workosUserId;
  const tierLevel = session.metadata?.tierLevel as 'community' | 'top';
  const priceId = session.metadata?.priceId;

  if (!workosUserId || !tierLevel || !priceId) {
    logger.error('Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  logger.info(`Checkout completed for user ${workosUserId}, tier: ${tierLevel}`);

  // Get subscription ID from session
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId) {
    logger.error('No subscription ID in checkout session', { sessionId: session.id });
    return;
  }

  // Subscription will be created/updated by the subscription.created event
  // Just log the checkout completion
  logger.info(`Subscription ${subscriptionId} will be processed by subscription.created event`);
}

/**
 * Handle subscription created or updated
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  eventType: 'customer.subscription.created' | 'customer.subscription.updated',
) {
  const workosUserId = subscription.metadata.workosUserId;
  const tierLevel = (subscription.metadata.tierLevel as 'community' | 'top') || 'community';
  const billingInterval = (subscription.metadata.billingInterval as 'month' | 'year') || 'year';

  if (!workosUserId) {
    logger.error('Missing workosUserId in subscription metadata', { subscriptionId: subscription.id });
    return;
  }

  // Get user and organization
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.workosUserId, workosUserId),
    columns: {
      id: true,
      workosUserId: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    logger.error('User not found for workosUserId', { workosUserId });
    return;
  }

  // Get user's organization via membership
  const membership = await db.query.UserOrgMembershipsTable.findFirst({
    where: eq(UserOrgMembershipsTable.workosUserId, workosUserId),
    columns: { orgId: true },
  });

  const org = membership
    ? await db.query.OrganizationsTable.findFirst({
        where: eq(OrganizationsTable.id, membership.orgId),
        columns: { id: true },
      })
    : null;

  // Determine pricing details
  // Determine plan type from billing interval
  const planType: 'monthly' | 'annual' = billingInterval === 'month' ? 'monthly' : 'annual';

  // Get pricing config based on billing interval and tier
  const pricingConfig =
    billingInterval === 'month'
      ? tierLevel === 'top'
        ? SUBSCRIPTION_PRICING.monthly_subscription.top_expert
        : SUBSCRIPTION_PRICING.monthly_subscription.community_expert
      : tierLevel === 'top'
        ? SUBSCRIPTION_PRICING.annual_subscription.top_expert
        : SUBSCRIPTION_PRICING.annual_subscription.community_expert;

  // Get price item
  const priceItem = subscription.items.data[0];
  const priceId = typeof priceItem.price === 'string' ? priceItem.price : priceItem.price.id;

  if (!org) {
    logger.error('Organization not found for user', { workosUserId });
    return;
  }

  const existingPlan = await db.query.SubscriptionPlansTable.findFirst({
    where: eq(SubscriptionPlansTable.orgId, org.id),
  });

  const subscriptionData = {
    orgId: org.id,
    billingAdminUserId: workosUserId,
    planType,
    tierLevel,
    billingInterval,
    commissionRate: Math.round(pricingConfig.commissionRate * 10000), // Convert to basis points
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripePriceId: priceId,
    monthlyFee:
      billingInterval === 'month' && 'monthlyFee' in pricingConfig
        ? pricingConfig.monthlyFee
        : null,
    annualFee:
      billingInterval === 'year' && 'annualFee' in pricingConfig ? pricingConfig.annualFee : null,
    subscriptionStartDate: new Date(subscription.current_period_start * 1000),
    subscriptionEndDate: new Date(subscription.current_period_end * 1000),
    subscriptionStatus: subscription.status as 'active' | 'canceled' | 'past_due' | 'unpaid',
    autoRenew: !subscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  if (existingPlan) {
    // Update existing subscription
    await db
      .update(SubscriptionPlansTable)
      .set({
        ...subscriptionData,
        orgId: org.id,
      })
      .where(eq(SubscriptionPlansTable.id, existingPlan.id));

    logger.info(`Updated subscription plan: ${existingPlan.id}`);

    // Log event
    await db.insert(SubscriptionEventsTable).values({
      workosUserId,
      orgId: org.id,
      subscriptionPlanId: existingPlan.id,
      eventType: eventType === 'customer.subscription.created' ? 'plan_created' : 'plan_upgraded',
      previousPlanType: existingPlan.planType as 'commission' | 'monthly' | 'annual',
      previousTierLevel: existingPlan.tierLevel,
      newPlanType: subscriptionData.planType,
      newTierLevel: tierLevel,
      stripeEventId: subscription.id,
      stripeSubscriptionId: subscription.id,
      reason: 'stripe_webhook',
    });
  } else {
    // Create new subscription plan
    const [newPlan] = await db
      .insert(SubscriptionPlansTable)
      .values({
        ...subscriptionData,
        orgId: org.id,
      })
      .returning();

    logger.info(`Created subscription plan: ${newPlan.id}`);

    // Log event
    await db.insert(SubscriptionEventsTable).values({
      workosUserId,
      orgId: org.id,
      subscriptionPlanId: newPlan.id,
      eventType: 'subscription_started',
      newPlanType: 'annual',
      newTierLevel: tierLevel,
      stripeEventId: subscription.id,
      stripeSubscriptionId: subscription.id,
      reason: 'stripe_webhook',
    });
  }
}

/**
 * Handle subscription deleted (canceled and expired)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workosUserId = subscription.metadata.workosUserId;

  if (!workosUserId) {
    logger.error('Missing workosUserId in subscription metadata', { subscriptionId: subscription.id });
    return;
  }

  // Find subscription plan
  const plan = await db.query.SubscriptionPlansTable.findFirst({
    where: eq(SubscriptionPlansTable.stripeSubscriptionId, subscription.id),
  });

  if (!plan) {
    logger.error('Subscription plan not found for Stripe subscription', { subscriptionId: subscription.id });
    return;
  }

  // Update subscription status to canceled
  await db
    .update(SubscriptionPlansTable)
    .set({
      subscriptionStatus: 'canceled',
      autoRenew: false,
      updatedAt: new Date(),
    })
    .where(eq(SubscriptionPlansTable.id, plan.id));

  // Log event
  await db.insert(SubscriptionEventsTable).values({
    workosUserId,
    orgId: plan.orgId as string,
    subscriptionPlanId: plan.id,
    eventType: 'subscription_expired',
    previousPlanType: plan.planType,
    previousTierLevel: plan.tierLevel,
    stripeEventId: subscription.id,
    stripeSubscriptionId: subscription.id,
    reason: 'subscription_canceled',
  });

  logger.info(`Subscription canceled: ${plan.id}`);

  // TODO: Revert user to commission-based plan
  // This could be handled by the application logic when checking subscription status
}

/**
 * Handle successful invoice payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // Find subscription plan
  const plan = await db.query.SubscriptionPlansTable.findFirst({
    where: eq(SubscriptionPlansTable.stripeSubscriptionId, subscriptionId),
  });

  if (!plan) {
    logger.error('Subscription plan not found for invoice', { invoiceId: invoice.id });
    return;
  }

  // Update subscription status to active
  await db
    .update(SubscriptionPlansTable)
    .set({
      subscriptionStatus: 'active',
      updatedAt: new Date(),
    })
    .where(eq(SubscriptionPlansTable.id, plan.id));

  // Log payment success
  await db.insert(SubscriptionEventsTable).values({
    workosUserId: plan.billingAdminUserId,
    orgId: plan.orgId as string,
    subscriptionPlanId: plan.id,
    eventType: 'payment_succeeded',
    stripeEventId: invoice.id,
    stripeSubscriptionId: subscriptionId,
    reason: 'invoice_paid',
    metadata: {
      invoiceId: invoice.id,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
    },
  });

  logger.info(`Payment succeeded for subscription: ${plan.id}`);
}

/**
 * Handle failed invoice payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // Find subscription plan
  const plan = await db.query.SubscriptionPlansTable.findFirst({
    where: eq(SubscriptionPlansTable.stripeSubscriptionId, subscriptionId),
  });

  if (!plan) {
    logger.error('Subscription plan not found for invoice', { invoiceId: invoice.id });
    return;
  }

  // Update subscription status to past_due
  await db
    .update(SubscriptionPlansTable)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(SubscriptionPlansTable.id, plan.id));

  // Log payment failure
  await db.insert(SubscriptionEventsTable).values({
    workosUserId: plan.billingAdminUserId,
    orgId: plan.orgId as string,
    subscriptionPlanId: plan.id,
    eventType: 'payment_failed' as const,
    stripeEventId: invoice.id as string,
    stripeSubscriptionId: subscriptionId as string,
    reason: 'invoice_payment_failed',
  });

  logger.info(`Payment failed for subscription: ${plan.id}`);

  // TODO: Send notification to user about failed payment
  // TODO: Implement dunning management (retry logic, grace period)
}
