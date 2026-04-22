# Enhanced Stripe + Novu Marketplace Integration

This document outlines the comprehensive marketplace payment tracking and notification system using Stripe Connect and Novu workflows.

## Overview

Our marketplace integration provides complete payment traceability for all ClerkUserIDs with real-time notifications through multiple channels:

- **Stripe Connect** for marketplace payments
- **Novu Framework** for multi-channel notifications
- **Clerk Webhooks** for user lifecycle events
- **Enhanced payment tracking** for experts and clients

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Stripe        │    │   Clerk         │    │   Novu          │
│   Webhooks      │───▶│   Webhooks      │───▶│   Workflows     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Payment       │    │   User          │    │   Multi-channel │
│   Processing    │    │   Management    │    │   Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Features

### 🔄 Real-time Payment Tracking

- Payment received notifications for experts
- Payout processing alerts
- Connect account status updates
- Failed payment handling with automatic retries

### 📧 Multi-channel Notifications

- **In-app notifications** for immediate alerts
- **Email notifications** for detailed information
- **Marketplace-specific workflows** for payment events
- **User lifecycle notifications** via Clerk integration

### 🏦 Stripe Connect Integration

- Connect account onboarding tracking
- Payout schedule notifications
- Bank account verification alerts
- Identity verification status updates

### 👥 User Management

- New user welcome workflows
- Expert onboarding completion
- Security alerts and login notifications
- Profile update confirmations

## Implementation

### 1. Webhook Endpoints

#### Stripe Webhooks (`/api/webhooks/stripe`)

Handles marketplace payment events:

- `payment_intent.succeeded` - Payment received
- `payout.paid` - Payout processed
- `payout.failed` - Payout failed
- `account.updated` - Connect account status change
- `account.external_account.created/deleted` - Bank account changes

#### Clerk Webhooks (`/api/webhooks/clerk`)

Handles user lifecycle events:

- `user.created` - New user registration
- `user.updated` - Profile updates
- `session.created` - Login tracking
- `email.created` - Email event notifications

### 2. Novu Workflows

#### Marketplace Payment Workflows

```typescript
// Payment received notification
marketplacePaymentReceivedWorkflow
- In-app notification with payment details
- Email with transaction summary
- Dashboard link for payment history

// Payout processed notification
marketplacePayoutProcessedWorkflow
- In-app notification with payout details
- Email with bank transfer information
- Expected arrival date

// Connect account status updates
marketplaceConnectAccountStatusWorkflow
- Account activation notifications
- Required action alerts
- Setup completion confirmations
```

#### User Lifecycle Workflows

```typescript
// New user welcome
userCreatedWorkflow
- Welcome message with next steps
- Profile completion guidance
- Platform introduction

// Expert onboarding
expertOnboardingCompleteWorkflow
- Congratulations message
- Platform capabilities overview
- Dashboard access

// Security notifications
recentLoginWorkflow
- Login detection alerts
- Location and device information
- Security recommendations
```

### 3. Enhanced Payment Handlers

#### Payment Success Handler

```typescript
// Enhanced with marketplace notifications
export async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // 1. Update meeting status
  // 2. Create calendar event
  // 3. Update transfer record
  // 4. Send expert notification (existing system)
  // 5. Trigger Novu marketplace workflow (NEW)
  // 6. Send client confirmation email
}
```

#### Payout Handlers

```typescript
// New payout tracking
export async function handlePayoutPaid(payout: Stripe.Payout) {
  // 1. Find expert by Connect account
  // 2. Calculate arrival date
  // 3. Trigger Novu payout workflow
  // 4. Send multi-channel notifications
}
```

## Configuration

### Environment Variables

```bash
# Novu Configuration
NOVU_SECRET_KEY=novu_secret_...

# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGNING_SECRET=whsec_...

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Webhook Setup

#### Stripe Dashboard

1. Navigate to **Webhooks** in Stripe Dashboard
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payout.paid`
   - `payout.failed`
   - `account.updated`
   - `account.external_account.created`
   - `account.external_account.deleted`

#### Clerk Dashboard

1. Navigate to **Webhooks** in Clerk Dashboard
2. Add endpoint: `https://yourdomain.com/api/webhooks/clerk`
3. Select events:
   - `user.created`
   - `user.updated`
   - `session.created`
   - `email.created`

### Novu Dashboard Setup

1. Create workflows matching the IDs in `config/novu.ts`
2. Configure notification templates
3. Set up delivery channels (email, in-app)
4. Test workflow triggers

## Payment Flow with Notifications

### 1. Client Books Session

```
Client Payment → Stripe → Payment Intent Created
                    ↓
              Meeting Created (Pending)
                    ↓
              Slot Reserved
```

### 2. Payment Succeeds

```
Payment Success → Update Meeting Status
                    ↓
              Create Calendar Event
                    ↓
              Update Transfer Record
                    ↓
         ┌─────────────────────────────┐
         │  Dual Notification System   │
         ├─────────────────────────────┤
         │  1. Legacy System           │
         │     - createUserNotification│
         │     - In-app only           │
         │                             │
         │  2. Novu Workflow (NEW)     │
         │     - Multi-channel         │
         │     - Email + In-app        │
         │     - Rich templates        │
         └─────────────────────────────┘
                    ↓
              Client Email Confirmation
```

### 3. Payout Processing

```
Stripe Payout Event → Find Expert by Connect Account
                         ↓
                  Trigger Novu Workflow
                         ↓
              ┌─────────────────────────┐
              │   Payout Notification   │
              ├─────────────────────────┤
              │ • Amount transferred    │
              │ • Expected arrival      │
              │ • Bank account details  │
              │ • Dashboard link        │
              └─────────────────────────┘
```

## Benefits

### For Experts

- **Real-time payment notifications** when clients pay
- **Payout tracking** with arrival dates
- **Account status updates** for Connect setup
- **Comprehensive payment history** in dashboard

### For Clients

- **Immediate booking confirmations** via email
- **Meeting details** with calendar links
- **Payment receipts** with transaction IDs
- **Support contact** for payment issues

### For Platform

- **Complete audit trail** of all payment events
- **Automated notification delivery** reduces support load
- **Enhanced user experience** with timely updates
- **Scalable notification system** via Novu

## Monitoring and Debugging

### Webhook Logs

```typescript
// All webhook events are logged with context
console.log('Stripe webhook verified:', event.type);
console.log('✅ Novu workflow triggered for Connect account update');
console.log('❌ Failed to trigger marketplace payment notification:', error);
```

### Error Handling

- **Graceful degradation**: Novu failures don't break existing flows
- **Retry logic**: Critical operations use `withRetry` wrapper
- **Audit logging**: All payment events logged for compliance
- **Dead letter queues**: Failed operations stored for manual review

### Testing

```bash
# Test Stripe webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test Clerk webhooks
# Use Clerk Dashboard webhook testing interface

# Test Novu workflows
# Use Novu Dashboard workflow testing
```

## Migration Notes

This integration is **additive** and **backward-compatible**:

- Existing notification system continues to work
- New Novu workflows provide enhanced functionality
- No breaking changes to current payment flows
- Can be gradually rolled out per user segment

## Future Enhancements

1. **SMS Notifications** via Novu SMS channel
2. **Push Notifications** for mobile app
3. **Slack Integration** for admin alerts
4. **Custom Notification Preferences** per user
5. **A/B Testing** for notification templates
6. **Analytics Dashboard** for notification metrics

## Support

For issues with this integration:

1. Check webhook delivery in Stripe/Clerk dashboards
2. Verify Novu workflow configuration
3. Review application logs for error details
4. Test individual components in isolation
5. Contact development team with specific error messages
