# Core Systems Documentation

> **Critical systems that power the Eleva Care platform - authentication, payments, scheduling, notifications, and caching**

**Last Updated:** February 6, 2025  
**Status:** ✅ Production Ready

---

## 📋 Overview

This section contains documentation for all core application systems that are essential for Eleva Care's operation. These are production-critical systems that require careful maintenance and monitoring.

---

## 🎯 Systems Overview

### 1. Authentication (`authentication/`)

**WorkOS-based authentication and authorization system**

Eleva Care uses WorkOS AuthKit for enterprise-grade authentication with organization-per-user isolation.

**Key Features:**

- WorkOS AuthKit for passwordless auth
- Organization-centric multi-tenancy
- Row-Level Security (RLS)
- Role-Based Access Control (RBAC)
- HIPAA/GDPR compliant

📄 **Key Documents:**

- ~~[Clerk Configuration](./authentication/01-clerk-configuration.md)~~ ❌ **DEPRECATED** - See WorkOS docs instead
- [Role Management](./authentication/02-role-management.md) ✅ Still relevant
- [Permission System](./authentication/03-permission-system.md) ✅ Still relevant
- [Route Protection](./authentication/04-route-protection.md) ✅ Still relevant

**🔗 See Also:**

- **[WorkOS Migration Docs](../WorkOS-migration/README.md)** - Complete WorkOS documentation
- **[Getting Started with WorkOS](../WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md)** - Tutorial
- **[WorkOS Authentication](../WorkOS-migration/reference/workos-authentication.md)** - Reference
- **[Org-Per-User Model](../WorkOS-migration/reference/org-per-user-model.md)** - Architecture

---

### 2. Caching (`caching/`)

**Unified Redis-based caching system for all application data**

Upstash Redis provides serverless caching for improved performance.

**Key Features:**

- Redis for user data caching
- Stripe customer/subscription cache
- Rate limiting and DDoS protection
- Session caching
- Query result caching

📄 **Key Documents:**

- [Redis Caching](./caching/01-redis-caching.md) ✅ Core implementation
- ~~[Clerk User Cache](./caching/02-clerk-user-cache.md)~~ ❌ **DEPRECATED** - Migrated to WorkOS
- [Stripe Customer Cache](./caching/03-stripe-customer-cache.md) ✅ Still relevant
- [Rate Limiting](./caching/04-rate-limiting.md) ✅ Still relevant

**Migration Notes:**

- Clerk user caching replaced with WorkOS session caching
- See [CACHE-MIGRATION-GUIDE.md](../WorkOS-migration/CACHE-MIGRATION-GUIDE.md)

---

### 3. Notifications (`notifications/`)

**Novu-based notification system for multi-channel communications**

Novu Framework powers all transactional notifications (email, in-app, SMS).

**Key Features:**

- Multi-channel notifications (email, in-app, SMS)
- Workflow-based notifications
- User preference management
- Delivery tracking and analytics
- Integration with Stripe events

📄 **Key Documents:**

- [Novu Integration](./notifications/01-novu-integration.md) ✅ Core setup
- [Notification Workflows](./notifications/02-notification-workflows.md) ✅ Workflows
- [Stripe Notifications](./notifications/03-stripe-notifications.md) ✅ Payment events
- [Framework Setup](./notifications/04-novu-framework-setup.md) ✅ Configuration
- [Production Ready](./notifications/07-novu-workflows-production-ready.md) ✅ Status

**Latest Status:**

- All workflows migrated to Novu Framework
- WorkOS integration complete
- Production-ready

---

### 4. Payments (`payments/`)

**Stripe-based payment processing system with Multibanco support**

Complete payment infrastructure including card payments, bank transfers, refunds, and expert payouts.

**Key Features:**

- Card and Multibanco payments
- Stripe Connect for expert payouts
- Automated refund processing
- Customer-first refund policy
- Payment restrictions and validation
- Webhook-based event handling

📄 **Key Documents:**

- [Payment Flow Analysis](./payments/01-payment-flow-analysis.md) ✅ Architecture
- [Stripe Integration](./payments/02-stripe-integration.md) ✅ Core setup
- [Payout Processing](./payments/03-enhanced-payout-processing.md) ✅ Expert payouts
- [Payment Restrictions](./payments/04-payment-restrictions.md) ✅ Validation
- [Multibanco Integration](./payments/06-multibanco-integration.md) ✅ Portuguese payments
- [Refund Policy v3.0](./payments/08-policy-v3-customer-first-100-refund.md) ✅ Refund rules
- **[Payment README](./payments/README.md)** ⭐ **Comprehensive guide**

---

### 5. Scheduling (`scheduling/`)

**Appointment scheduling and booking system**

Core scheduling engine for appointment management and availability.

**Key Features:**

- Expert availability management
- Google Calendar integration
- Timezone handling
- Booking validation
- Conflict prevention

📄 **Key Documents:**

- [Scheduling Engine](./scheduling/01-scheduling-engine.md) ✅ Core logic
- [Booking Layout](./scheduling/02-booking-layout.md) ✅ UI/UX

---

### 6. Subscription System (NEW)

**Organization-centric subscription management**

Hybrid pricing model with commission-based, monthly, and annual tiers.

**Key Features:**

- Three-tier pricing (Commission / Monthly / Annual)
- Organization-owned subscriptions
- Automated eligibility checks
- Commission tracking
- Stripe Billing integration

📄 **Key Documents:**

- [Subscription Implementation](./SUBSCRIPTION-IMPLEMENTATION-STATUS.md) ✅ Status
- [Subscription Pricing](../../.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md) ✅ Pricing model
- [Organization Billing](../../.cursor/plans/subscription-billing-entity-analysis.md) ✅ Architecture
- [Three-Party Clinic Model](./THREE-PARTY-CLINIC-REVENUE-MODEL.md) ⭐ **Option B** (Future Phase 2)

---

### 7. Role Progression System (NEW)

**Expert tier advancement based on performance**

Inspired by Airbnb's Host/Superhost model for healthcare services.

**Key Features:**

- Tiered expert system (Community → Top → Lecturer)
- Performance-based progression
- Automated eligibility calculation
- Tier-based benefits
- Integration with subscriptions

📄 **Key Documents:**

- [Role Progression System](./ROLE-PROGRESSION-SYSTEM.md) ✅ Complete design
- [Role Management](./authentication/02-role-management.md) ✅ RBAC implementation

---

## 🚀 Quick Start

### For New Developers

**Day 1: Authentication**

1. Start with [Getting Started with WorkOS](../WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md)
2. Review [WorkOS Authentication](../WorkOS-migration/reference/workos-authentication.md)
3. Understand [Org-Per-User Model](../WorkOS-migration/reference/org-per-user-model.md)

**Day 2: Payments**

1. Read [Payment README](./payments/README.md)
2. Review [Stripe Integration](./payments/02-stripe-integration.md)
3. Understand [Payout Processing](./payments/03-enhanced-payout-processing.md)

**Day 3: Core Systems**

1. Learn [Redis Caching](./caching/01-redis-caching.md)
2. Check [Novu Integration](./notifications/01-novu-integration.md)
3. Review [Scheduling Engine](./scheduling/01-scheduling-engine.md)

---

### For Operations

**Daily Monitoring:**

1. Check [Health Endpoints](#health-check-endpoints)
2. Review error logs in Sentry
3. Monitor Stripe dashboard

**Weekly Reviews:**

1. Review [Payment Flow](./payments/01-payment-flow-analysis.md)
2. Check cache hit rates
3. Monitor notification delivery

---

## 🏗️ System Dependencies

### External Services

| Service           | Purpose                  | Criticality | Status        |
| ----------------- | ------------------------ | ----------- | ------------- |
| **WorkOS**        | Authentication & RBAC    | 🔴 Critical | ✅ Production |
| **Stripe**        | Payments & Subscriptions | 🔴 Critical | ✅ Production |
| **Novu**          | Notifications            | 🟡 High     | ✅ Production |
| **Upstash Redis** | Caching & Rate Limiting  | 🟡 High     | ✅ Production |
| **Neon Database** | Data Storage (Postgres)  | 🔴 Critical | ✅ Production |
| **PostHog**       | Analytics                | 🟢 Medium   | ✅ Production |
| **Sentry**        | Error Monitoring         | 🟢 Medium   | ✅ Production |
| **Better Stack**  | Uptime Monitoring        | 🟢 Medium   | ✅ Production |

### Internal Dependencies

- All systems use centralized Redis caching
- Notifications triggered by payment and booking events
- Authentication required for all user actions
- Scheduling depends on payment completion
- Subscriptions integrated with authentication (org-level)

---

## 🔍 Monitoring & Health

### Health Check Endpoints

```bash
# Overall system health
curl https://app.eleva.care/api/healthcheck?services=true

# Individual service health checks
curl https://app.eleva.care/api/health/workos
curl https://app.eleva.care/api/health/stripe
curl https://app.eleva.care/api/health/novu
curl https://app.eleva.care/api/health/upstash-redis
curl https://app.eleva.care/api/health/database
```

### Key Metrics

**Authentication (WorkOS):**

- Login success rate: 99.5%+
- Average session duration: 7 days
- OAuth callback time: <500ms
- JWT verification time: <10ms

**Payments (Stripe):**

- Payment success rate: 95%+
- Payout processing time: <2 hours
- Refund processing time: <1 hour
- Webhook delivery success: 99%+

**Notifications (Novu):**

- Email delivery rate: 98%+
- In-app delivery: 100%
- Average send time: <2 seconds
- Open rate: 45%+

**Caching (Redis):**

- Cache hit rate: 85%+
- Average latency: <10ms
- Memory usage: <50%
- Connection pool: 10 connections

**See:** [Monitoring Guide](../03-infrastructure/monitoring/) for detailed metrics.

---

## 🚨 Troubleshooting

### Common Issues

**Authentication Issues**

- ❌ Check WorkOS dashboard for user status
- ❌ Verify environment variables (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)
- ❌ Review JWT token expiry (1 hour default)
- ✅ See: [TROUBLESHOOT-NEON-JWKS.md](../WorkOS-migration/setup/TROUBLESHOOT-NEON-JWKS.md)

**Payment Failures**

- ❌ Check Stripe dashboard for error details
- ❌ Verify webhook delivery (stripe.com/docs/webhooks)
- ❌ Review payment restrictions
- ✅ See: [Payment Flow](./payments/01-payment-flow-analysis.md)

**Cache Misses**

- ❌ Check Redis health endpoint
- ❌ Review cache TTL settings (may be expired)
- ❌ Verify Redis connection
- ✅ See: [Redis Caching](./caching/01-redis-caching.md)

**Notification Failures**

- ❌ Check Novu dashboard for delivery logs
- ❌ Verify workflow configuration
- ❌ Check user notification preferences
- ✅ See: [Novu Integration](./notifications/01-novu-integration.md)

---

## 📖 Development Guidelines

### Adding New Features

1. **Document First**: Create implementation guide
2. **Consider Caching**: Add Redis caching for expensive operations
3. **Add Monitoring**: Include health checks and metrics
4. **Test Thoroughly**: Unit, integration, and E2E tests
5. **Update Docs**: Keep this README and related docs current
6. **Consider RLS**: Ensure org-scoped queries for data isolation

### Best Practices

- ✅ Use centralized Redis for all caching
- ✅ Always validate payments with Stripe webhooks
- ✅ Implement proper error handling and logging (Sentry)
- ✅ Add PostHog analytics for key user actions
- ✅ Follow existing patterns for consistency
- ✅ Ensure RLS policies for all org-scoped data
- ✅ Use WorkOS sessions for authentication
- ✅ Prefer server actions over API routes

### Code Style

```typescript
// ✅ Good: Server action with auth
'use server';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function getSubscription() {
  const { user } = await withAuth({ ensureSignedIn: true });
  // ... implementation
}

// ✅ Good: Org-scoped query
const data = await db.query.MeetingsTable.findMany({
  where: eq(MeetingsTable.orgId, orgId),
});

// ❌ Bad: User-scoped query (should be org-scoped)
const data = await db.query.MeetingsTable.findMany({
  where: eq(MeetingsTable.workosUserId, userId),
});
```

---

## 📚 Related Documentation

- **Infrastructure**: [Infrastructure Docs](../03-infrastructure/README.md)
- **Development**: [Development Guides](../04-development/README.md)
- **Legal**: [Legal & Compliance](../06-legal/README.md)
- **Deployment**: [Deployment Guides](../08-deployment/README.md)
- **WorkOS Migration**: [WorkOS Docs](../WorkOS-migration/README.md)

---

## 🎯 Roadmap

### Recently Completed

- ✅ WorkOS authentication migration (Feb 2025)
- ✅ Subscription system backend (Feb 2025)
- ✅ Organization-centric billing (Feb 2025)
- ✅ Novu Framework migration (Jan 2025)
- ✅ Multibanco integration (Dec 2024)

### In Progress

- 🚧 Subscription UI/UX (Week 1-2, Feb 2025)
- 🚧 Commission tracking (Week 2-3, Feb 2025)
- 🚧 Role progression system (Week 3-5, Feb 2025)

### Planned

- 📅 Expert verification system (Mar 2025)
- 📅 Advanced analytics dashboard (Mar 2025)
- 📅 Mobile app (Q2 2025)

---

## 🤝 Contributing

### Documentation Updates

When updating documentation:

1. Follow the existing structure
2. Update this README if adding new systems
3. Keep status indicators current (✅ ❌ 🚧 📅)
4. Add links to related documentation
5. Include code examples where helpful
6. Update "Last Updated" date

### Code Changes

1. Update relevant documentation
2. Add tests for new features
3. Ensure RLS policies are correct
4. Add health checks if applicable
5. Update monitoring dashboards

---

**Last Updated:** February 6, 2025  
**Maintained By:** Engineering Team  
**Questions?** See individual system documentation or contact #engineering

---

## 📖 Quick Links

**Start Here:**

- [Getting Started with WorkOS](../WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md)
- [Payment System README](./payments/README.md)
- [Subscription Implementation](./SUBSCRIPTION-IMPLEMENTATION-STATUS.md)

**Reference:**

- [WorkOS Authentication](../WorkOS-migration/reference/workos-authentication.md)
- [Org-Per-User Model](../WorkOS-migration/reference/org-per-user-model.md)
- [Row-Level Security](../WorkOS-migration/reference/neon-auth-rls.md)

**Guides:**

- [Setup WorkOS Environment](../WorkOS-migration/setup/SETUP-WORKOS-ENV.md)
- [Role Management](./authentication/02-role-management.md)
- [Stripe Integration](./payments/02-stripe-integration.md)
