# Guides & How-Tos

> **Practical guides, troubleshooting procedures, and feature implementation guides for Eleva Care**

## Overview

This section contains practical how-to guides, feature documentation, and troubleshooting procedures for common scenarios.

---

## Guide Categories

### 1. Features (`features/`)

Feature implementation guides and documentation.

- **Customer ID System**: Unique customer identification
- **Profile Publishing**: Expert profile visibility controls
- **Multilingual Checkout**: Internationalized payment flow

📄 **Key Files:**

- [Customer ID System](./features/01-customer-id-system.md)
- [Profile Publishing](./features/02-profile-publishing.md)
- [Multilingual Checkout](./features/03-multilingual-checkout.md)

---

### 2. Troubleshooting (`troubleshooting/`)

Step-by-step troubleshooting procedures.

- **Customer Cache**: Fixing cache synchronization issues
- **Payment Flow**: Verifying payment processing
- **Payout Diagnosis**: Expert payout troubleshooting

📄 **Key Files:**

- [Customer Cache Fixes](./troubleshooting/01-customer-cache-fixes.md)
- [Payment Flow Verification](./troubleshooting/02-payment-flow-verification.md)
- [Payout Diagnosis](./troubleshooting/03-payout-diagnosis.md)

---

### 3. Bot Protection (`botid-implementation.md`)

BotID integration for bot detection and protection.

📄 **Key File:**

- [BotID Implementation](./botid-implementation.md)

---

### 4. Legacy (`legacy/`)

Archived feature documentation for reference.

- **Monorepo Migration**: Historical migration notes
- **Customers Section**: Deprecated customer management

📄 **Key Files:**

- [Monorepo Migration](./legacy/01-monorepo-migration.md)
- [Customers Section](./legacy/02-customers-section.md)

---

## Quick Reference Guides

### Common Tasks

#### Adding a New Feature

1. **Plan**: Document requirements
2. **Design**: Create technical design doc
3. **Implement**: Follow coding standards
4. **Test**: Write comprehensive tests
5. **Document**: Update relevant docs
6. **Deploy**: Follow deployment process

#### Troubleshooting Payment Issues

1. Check Stripe dashboard for errors
2. Verify webhook delivery in Stripe
3. Review payment intent status
4. Check customer cache synchronization
5. Verify environment variables
6. Review application logs

See [Payment Flow Verification](./troubleshooting/02-payment-flow-verification.md) for details.

#### Debugging Expert Payouts

1. Check Stripe Connect dashboard
2. Verify expert account status
3. Review payout schedule
4. Check transfer history
5. Verify QStash cron jobs running
6. Check heartbeat monitoring

See [Payout Diagnosis](./troubleshooting/03-payout-diagnosis.md) for details.

---

## Feature Guides

### Customer ID System

**Purpose**: Unique identification for customers across sessions and devices

**Key Concepts:**

- UUID-based customer IDs
- Stripe customer mapping
- Clerk user association
- Cache synchronization

**Use Cases:**

- Payment processing
- Customer data retrieval
- Session management
- Analytics tracking

See [Customer ID System](./features/01-customer-id-system.md) for implementation details.

---

### Profile Publishing

**Purpose**: Control expert profile visibility and search indexing

**States:**

- **Draft**: Profile not visible to public
- **Published**: Profile visible and searchable
- **Suspended**: Temporarily hidden

**Features:**

- Manual publish/unpublish
- Required fields validation
- SEO optimization
- Search index updates

See [Profile Publishing](./features/02-profile-publishing.md) for complete guide.

---

### Multilingual Checkout

**Purpose**: Localized payment experience in EN, ES, PT, BR

**Features:**

- Translated payment forms
- Localized currency display
- Region-specific payment methods (Multibanco for PT)
- Translated confirmation emails

**Implementation:**

- Next-intl for translations
- Stripe localization
- Email template localization
- Error message translation

See [Multilingual Checkout](./features/03-multilingual-checkout.md) for details.

---

## Troubleshooting Procedures

### Payment Flow Issues

#### Symptom: Payment Intent Creation Fails

**Checklist:**

- [ ] Verify Stripe API keys in environment
- [ ] Check Stripe dashboard for errors
- [ ] Verify customer ID exists
- [ ] Check rate limiting logs
- [ ] Review request payload
- [ ] Verify amount and currency format

**Solution Steps:**

1. Check application logs for errors
2. Verify customer cache synchronization
3. Test with Stripe test mode
4. Review error response from Stripe
5. Check for duplicate payment attempts

---

#### Symptom: Webhook Not Received

**Checklist:**

- [ ] Verify webhook URL in Stripe dashboard
- [ ] Check webhook signature validation
- [ ] Review webhook event types
- [ ] Check Svix CLI logs (development)
- [ ] Verify HTTPS certificate (production)

**Solution Steps:**

1. Check Stripe webhook logs
2. Verify webhook endpoint is accessible
3. Test webhook signature locally
4. Review webhook handler implementation
5. Check for firewall or security rules

---

### Expert Payout Issues

#### Symptom: Expert Not Receiving Payouts

**Checklist:**

- [ ] Verify Stripe Connect account status
- [ ] Check transfer status in Stripe
- [ ] Review payout schedule
- [ ] Verify bank account details
- [ ] Check country-specific delays
- [ ] Review QStash cron job logs

**Solution Steps:**

1. Check Stripe Connect dashboard
2. Verify `process-pending-payouts` cron job ran
3. Review transfer history
4. Check for errors in QStash logs
5. Verify heartbeat monitoring status
6. Contact Stripe support if needed

See [Payout Diagnosis](./troubleshooting/03-payout-diagnosis.md) for complete guide.

---

### Cache Synchronization Issues

#### Symptom: User Data Not Updating

**Checklist:**

- [ ] Check Redis health
- [ ] Verify cache TTL settings
- [ ] Review cache invalidation logic
- [ ] Check for cache key collisions
- [ ] Verify environment variables

**Solution Steps:**

1. Check Redis health endpoint
2. Manually invalidate affected cache keys
3. Review recent code changes
4. Verify cache key generation
5. Check PostHog for cache metrics

See [Customer Cache Fixes](./troubleshooting/01-customer-cache-fixes.md) for details.

---

## Bot Protection

### BotID Integration

**Purpose**: Detect and block malicious bots and automated attacks

**Features:**

- Real-time bot detection
- Risk scoring
- IP blocking
- User agent analysis
- Behavioral analysis

**Implementation:**

- Client-side SDK integration
- Server-side verification
- Challenge pages for suspicious requests
- Analytics and reporting

**Configuration:**

```typescript
import { botid } from '@/lib/botid';

// Verify request
const result = await botid.verify(request);
if (result.isBot) {
  return new Response('Forbidden', { status: 403 });
}
```

See [BotID Implementation](./botid-implementation.md) for complete setup.

---

## Best Practices

### Feature Development

1. **Document First**: Write implementation guide before coding
2. **Test Thoroughly**: Unit, integration, and E2E tests
3. **Consider Scale**: Design for growth
4. **Monitor Metrics**: Add PostHog events
5. **Error Handling**: Graceful degradation
6. **User Experience**: Loading and error states

### Troubleshooting Approach

1. **Reproduce**: Confirm the issue
2. **Isolate**: Narrow down the cause
3. **Document**: Record symptoms and steps
4. **Fix**: Implement solution
5. **Verify**: Test thoroughly
6. **Prevent**: Add monitoring/alerts

### Documentation

1. **Keep Current**: Update as you build
2. **Be Specific**: Include code examples
3. **Add Context**: Explain why, not just what
4. **Link Related**: Cross-reference docs
5. **Include Screenshots**: Visual aids help

---

## Related Documentation

- **Core Systems**: [Core Systems Docs](../02-core-systems/README.md)
- **Development**: [Development Guides](../04-development/README.md)
- **Infrastructure**: [Infrastructure Docs](../03-infrastructure/README.md)
- **Deployment**: [Deployment Guides](../08-deployment/README.md)

---

**Last Updated**: January 2025  
**Maintained By**: Engineering Team  
**Questions?** Post in #engineering Slack channel
