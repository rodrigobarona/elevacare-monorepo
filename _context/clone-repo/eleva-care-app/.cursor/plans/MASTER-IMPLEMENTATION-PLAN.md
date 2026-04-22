# Eleva Care - Master Implementation Plan

**Version:** 1.0  
**Last Updated:** February 6, 2025  
**Status:** 🎯 Active Development  

---

## 📋 Table of Contents

- [Overview](#-overview)
- [System Status](#-system-status)
- [Current Priorities](#-current-priorities)
- [Implementation Roadmap](#-implementation-roadmap)
- [Next 30 Days](#-next-30-days)
- [Technical Debt](#-technical-debt)
- [References](#-references)

---

## 🎯 Overview

This document consolidates all active development plans for Eleva Care, providing a single source of truth for:

1. **WorkOS Authentication** - Migration status and remaining items
2. **Subscription System** - Backend complete, frontend pending
3. **Role Progression** - Expert growth and tier system
4. **Core Systems** - Payments, notifications, caching

---

## 📊 System Status

### ✅ Completed Systems

| System                        | Status      | Completion | Notes                                    |
| ----------------------------- | ----------- | ---------- | ---------------------------------------- |
| **WorkOS Authentication**     | ✅ Complete | 95%        | Core migration done, minor TODOs remain  |
| **Organization Model**        | ✅ Complete | 100%       | Org-per-user implemented with RLS        |
| **Subscription Backend**      | ✅ Complete | 100%       | Database, actions, webhooks operational  |
| **Stripe Integration**        | ✅ Complete | 100%       | Payments, transfers, subscriptions       |
| **Novu Notifications**        | ✅ Complete | 100%       | All workflows production-ready           |
| **Redis Caching**             | ✅ Complete | 100%       | User, Stripe, rate limiting              |
| **Database Migration System** | ✅ Complete | 100%       | Drizzle ORM with automated migrations    |

### 🚧 In Progress

| System                   | Status         | Completion | Next Milestone                |
| ------------------------ | -------------- | ---------- | ----------------------------- |
| **Subscription UI/UX**   | 🚧 In Progress | 30%        | Create subscription dashboard |
| **Role Progression**     | 🚧 In Progress | 20%        | Define requirements and flows |
| **Commission Tracking**  | 🚧 In Progress | 40%        | Integrate with subscriptions  |

### 📅 Planned

| System                    | Status    | Priority | Start Date |
| ------------------------- | --------- | -------- | ---------- |
| **Expert Verification**   | 📅 Planned | HIGH     | Feb 2025   |
| **Advanced Analytics**    | 📅 Planned | MEDIUM   | Mar 2025   |
| **Mobile App**            | 📅 Planned | LOW      | Q2 2025    |

---

## 🎯 Current Priorities

### Priority 1: Subscription System Launch (Week 1-2)

**Goal:** Complete subscription UI and launch to first experts

**Tasks:**
1. ✅ Backend implementation (Complete)
2. ⏳ Create subscription dashboard
3. ⏳ Build pricing page
4. ⏳ Implement checkout flow
5. ⏳ Add subscription management UI
6. ⏳ Test end-to-end flow
7. ⏳ Launch to beta users

**Blocker:** None  
**Risk:** 🟢 LOW  
**Estimated:** 1-2 weeks

---

### Priority 2: Commission Tracking (Week 2-3)

**Goal:** Accurate commission calculation and tracking per subscription tier

**Tasks:**
1. ⏳ Track commission on each payment
2. ⏳ Calculate based on subscription tier
3. ⏳ Record in `transaction_commissions` table
4. ⏳ Update payout calculations
5. ⏳ Add commission reporting
6. ⏳ Test with real transactions

**Blocker:** Requires Subscription UI (Priority 1)  
**Risk:** 🟢 LOW  
**Estimated:** 1 week

---

### Priority 3: Role Progression System (Week 3-5)

**Goal:** Implement expert tier progression based on performance

**Tasks:**
1. ⏳ Define tier requirements (metrics)
2. ⏳ Create eligibility calculation system
3. ⏳ Build progression dashboard
4. ⏳ Implement upgrade/downgrade flows
5. ⏳ Add notification workflows
6. ⏳ Test tier transitions

**Blocker:** Requires Commission Tracking (Priority 2)  
**Risk:** 🟡 MEDIUM  
**Estimated:** 2-3 weeks

**See:** `ROLE-PROGRESSION-SYSTEM.md` for detailed plan

---

### Priority 4: WorkOS Migration Completion (Week 4-6)

**Goal:** Complete remaining WorkOS migration tasks

**Critical TODOs:**
1. ⏳ Add `username` field to UsersTable
2. ⏳ Update profile URLs to use username
3. ⏳ Implement sitemap generation
4. ⏳ Make `orgId` fields `.notNull()`
5. ⏳ Complete webhook handlers
6. ⏳ Update tests from Clerk to WorkOS

**Blocker:** None (non-blocking items)  
**Risk:** 🟢 LOW  
**Estimated:** 1-2 weeks

---

## 🗺️ Implementation Roadmap

### Month 1 (February 2025)

**Week 1-2: Subscription Launch**
- Create subscription UI/UX
- Implement checkout flow
- Launch to beta users
- Gather feedback

**Week 3-4: Commission & Tracking**
- Implement commission tracking
- Update payout calculations
- Add reporting dashboards
- Test with real payments

---

### Month 2 (March 2025)

**Week 1-2: Role Progression Foundation**
- Define tier requirements
- Create eligibility system
- Build progression dashboard
- Test tier calculations

**Week 3-4: Role Progression Launch**
- Implement upgrade/downgrade flows
- Add notification workflows
- Launch tier system
- Monitor performance

---

### Month 3 (April 2025)

**Week 1-2: WorkOS Completion**
- Finish remaining TODOs
- Update all tests
- Complete documentation
- Production optimization

**Week 3-4: Analytics & Reporting**
- Build admin analytics
- Create expert dashboards
- Add performance metrics
- Implement insights

---

### Month 4-6 (May-July 2025)

**Advanced Features:**
- Expert verification system
- Advanced booking features
- Mobile app development
- International expansion prep

---

## 📅 Next 30 Days (Detailed)

### Week 1: Subscription UI (Feb 7-13)

**Days 1-2: Dashboard Setup**
```typescript
// Create subscription dashboard
app/(private)/dashboard/subscription/
  ├── page.tsx                 # Main dashboard
  ├── layout.tsx               # Subscription layout
  └── components/
      ├── CurrentPlan.tsx      # Current subscription display
      └── UsageMetrics.tsx     # Usage statistics
```

**Days 3-4: Pricing Page**
```typescript
// Create pricing page
app/(private)/dashboard/subscription/choose-plan/
  └── page.tsx                 # Plan selection with toggle

components/features/subscriptions/
  ├── PricingCard.tsx          # Individual plan card
  ├── PlanToggle.tsx           # Monthly/Annual toggle
  └── ComparisonTable.tsx      # Feature comparison
```

**Days 5-7: Checkout Flow**
```typescript
// Implement Stripe checkout
components/features/subscriptions/
  ├── CheckoutButton.tsx       # Trigger Stripe Checkout
  └── SubscriptionStatus.tsx   # Post-checkout status

// Handle success/cancel
app/(private)/dashboard/subscription/
  ├── success/page.tsx         # Checkout success
  └── canceled/page.tsx        # Checkout canceled
```

---

### Week 2: Subscription Management (Feb 14-20)

**Days 1-2: Manage Subscription**
```typescript
// Subscription management UI
app/(private)/dashboard/subscription/manage/
  └── page.tsx                 # Cancel, reactivate, upgrade

components/features/subscriptions/
  ├── CancelButton.tsx         # Cancel subscription
  ├── ReactivateButton.tsx     # Reactivate subscription
  └── UpgradePrompt.tsx        # Upgrade CTA
```

**Days 3-4: Testing**
- E2E checkout flow tests
- Webhook testing
- Cancel/reactivate flows
- Edge case handling

**Days 5-7: Launch Prep**
- Beta user onboarding
- Documentation updates
- Monitoring setup
- Launch checklist

---

### Week 3: Commission Tracking (Feb 21-27)

**Days 1-3: Commission Recording**
```typescript
// Update payment webhooks
app/api/webhooks/stripe-payments/route.ts
  - Get user's subscription
  - Calculate commission based on tier
  - Record in transaction_commissions table
  - Update meeting record

// Update server actions
server/actions/payments.ts
  - Add commission calculation helper
  - Update payout calculations
```

**Days 4-5: Commission Reporting**
```typescript
// Create commission reports
server/actions/commissions.ts
  - getTotalCommissionsPaid()
  - getCommissionsByPeriod()
  - getCommissionBreakdown()

// Add to dashboard
app/(private)/dashboard/earnings/
  └── page.tsx                 # Commission analytics
```

**Days 6-7: Testing & Validation**
- Unit tests for commission calc
- Integration tests with payments
- Verify payout calculations
- Test reporting accuracy

---

### Week 4: Role Progression Setup (Feb 28 - Mar 6)

**Days 1-2: Define Requirements**
```typescript
// Create tier requirements config
config/role-progression.ts
  - Community Expert requirements
  - Top Expert requirements
  - Lecturer requirements
  - Metrics definitions

// Create eligibility checker
lib/utils/role-eligibility.ts
  - checkEligibility()
  - calculateProgressToNext()
  - getRequirements()
```

**Days 3-4: Progression Dashboard**
```typescript
// Create progression UI
app/(private)/dashboard/progression/
  └── page.tsx                 # Tier progress display

components/features/progression/
  ├── TierCard.tsx             # Current tier info
  ├── ProgressBar.tsx          # Progress to next tier
  └── RequirementsList.tsx     # What's needed
```

**Days 5-7: Upgrade Flows**
```typescript
// Implement tier upgrade
server/actions/role-progression.ts
  - requestUpgrade()
  - approveUpgrade()
  - calculateMetrics()

// Add notifications
- Eligibility notification
- Upgrade approved
- Tier changed
```

---

## 🛠️ Technical Debt

### High Priority

1. **Username Field** (2 hours)
   - Add `username` column to `UsersTable`
   - Migrate existing users
   - Update profile URLs
   - Fix sitemap generation

2. **Test Migration** (1 week)
   - Convert Clerk tests to WorkOS
   - Add subscription tests
   - Update mocks
   - Achieve 80%+ coverage

3. **OrgId .notNull()** (1 day)
   - Update schema after data migration
   - Add constraints
   - Test RLS policies

### Medium Priority

4. **Webhook Handlers** (2 days)
   - Identity verification webhook
   - Stripe account webhook
   - WorkOS organization webhooks

5. **Caching Optimization** (3 days)
   - Remove deprecated Clerk caches
   - Add subscription caching
   - Optimize Redis usage

6. **Documentation Updates** (1 week)
   - Update all Clerk references to WorkOS
   - Add subscription guides
   - Create role progression docs

### Low Priority

7. **Code Cleanup** (1 week)
   - Remove deprecated files
   - Clean up commented code
   - Organize imports
   - Improve type safety

8. **Performance Optimization** (2 weeks)
   - Database query optimization
   - Image optimization
   - Bundle size reduction
   - Lazy loading

---

## 📚 References

### Master Documents

- **This Plan:** `.cursor/plans/MASTER-IMPLEMENTATION-PLAN.md`
- **Subscription Pricing:** `.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md`
- **Role Progression:** `docs/02-core-systems/ROLE-PROGRESSION-SYSTEM.md`
- **WorkOS Migration:** `docs/WorkOS-migration/README.md`

### Implementation Documents

- **Subscription Verification:** `.cursor/plans/subscription-implementation-verification.md`
- **Organization Migration:** `.cursor/plans/org-subscription-implementation-summary.md`
- **Billing Entity Analysis:** `.cursor/plans/subscription-billing-entity-analysis.md`

### Core Documentation

- **Core Systems:** `docs/02-core-systems/README.md`
- **Infrastructure:** `docs/03-infrastructure/README.md`
- **Development Guide:** `docs/04-development/README.md`

### Configuration Files

- **Pricing Config:** `config/subscription-pricing.ts`
- **Stripe Config:** `config/stripe.ts`
- **Database Schema:** `drizzle/schema-workos.ts`

---

## 🎯 Success Metrics

### Technical KPIs

- ✅ Zero build errors
- ✅ 95%+ test coverage (subscriptions)
- ✅ <200ms API response times
- ✅ 99.9% uptime
- ⏳ All WorkOS TODOs complete
- ⏳ Subscription system launched
- ⏳ Commission tracking active

### Business KPIs

- ⏳ 20+ beta subscribers (Month 1)
- ⏳ 30% conversion to paid plans
- ⏳ $10K MRR by Month 3
- ⏳ 50+ active experts by Month 6
- ⏳ 90%+ expert satisfaction

---

## 🚀 Launch Checklist

### Pre-Launch (Subscription System)

- [ ] All UI components created
- [ ] Stripe checkout tested
- [ ] Webhooks processing correctly
- [ ] Cancel/reactivate flows working
- [ ] Commission tracking implemented
- [ ] Documentation complete
- [ ] Beta users identified
- [ ] Monitoring setup
- [ ] Support materials ready

### Launch Day

- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Track conversions
- [ ] Respond to feedback
- [ ] Document issues
- [ ] Iterate quickly

### Post-Launch (Week 1)

- [ ] Analyze beta metrics
- [ ] Address critical issues
- [ ] Optimize conversion flow
- [ ] Update documentation
- [ ] Plan next iteration

---

## 📞 Support

### For Development Questions

- **Technical Issues:** Check relevant docs in `docs/`
- **Architecture Decisions:** See `.cursor/plans/`
- **Configuration:** Review `config/` files

### For Business Questions

- **Pricing:** `SUBSCRIPTION-PRICING-MASTER.md`
- **Role Progression:** `ROLE-PROGRESSION-SYSTEM.md`
- **Strategy:** Contact product team

---

**Status:** 🎯 Active Development  
**Next Review:** Weekly (Every Monday)  
**Owner:** Engineering Team  
**Priority:** HIGH

