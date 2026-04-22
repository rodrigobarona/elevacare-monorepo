# Eleva Care - Documentation Index

**Complete technical documentation for the Eleva Care platform**

**Last Updated:** February 24, 2026  
**Status:** ✅ Active & Maintained

---

## 🎯 Quick Navigation

### For Newcomers

**Start Here:**
1. [Getting Started](./01-getting-started/README.md) - Set up your development environment
2. [WorkOS Tutorial](./WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md) - Learn authentication
3. [Core Systems Overview](./02-core-systems/README.md) - Understand the architecture

### For Developers

**Most Used:**
- [Core Systems](./02-core-systems/README.md) - Authentication, payments, notifications
- [Development Guides](./04-development/README.md) - Coding standards and patterns
- [API Reference](./WorkOS-migration/reference/) - Technical specifications

### For Operations

**Monitoring & Deployment:**
- [Infrastructure](./03-infrastructure/README.md) - Deployment and monitoring
- [Deployment Guides](./08-deployment/README.md) - Production deployment

---

## 📚 Documentation Structure

This documentation follows the **[Diátaxis Framework](https://diataxis.fr/)** - a systematic approach to creating better documentation.

### The Four Types of Documentation

```
┌─────────────────────────────────────────┐
│                                         │
│   Learning-Oriented  │  Action-Oriented │
│                                         │
│     TUTORIALS        │    HOW-TO GUIDES │
│                                         │
│  Getting started     │  Solve specific  │
│  Step-by-step        │  problems        │
│  Success guaranteed  │  Goal-oriented   │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  Understanding       │  Information     │
│                                         │
│    EXPLANATION       │    REFERENCE     │
│                                         │
│  Why it works        │  Technical specs │
│  Background context  │  API docs        │
│  Theory & design     │  Dry but precise │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📖 Documentation by Type

### 1. Tutorials (Learning-Oriented)

**Goal:** Help beginners learn by doing

| Tutorial                                                                   | What You'll Learn                    | Time    | Level        |
| -------------------------------------------------------------------------- | ------------------------------------ | ------- | ------------ |
| **[Getting Started](./01-getting-started/README.md)**                      | Set up development environment       | 30 min  | 🟢 Beginner  |
| **[WorkOS Tutorial](./WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md)**   | Understand authentication flow       | 45 min  | 🟢 Beginner  |
| **[Payment Flow](./02-core-systems/payments/README.md)**                   | Process your first payment           | 1 hour  | 🟡 Intermediate |
| **[Subscription Setup](./02-core-systems/SUBSCRIPTION-IMPLEMENTATION-STATUS.md)** | Implement subscription features      | 2 hours | 🟡 Intermediate |

---

### 2. How-To Guides (Action-Oriented)

**Goal:** Solve specific problems

| Guide                                                                      | Problem Solved                       | Difficulty   |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------ |
| **[Setup WorkOS Environment](./WorkOS-migration/setup/SETUP-WORKOS-ENV.md)** | Configure authentication             | 🟢 Easy      |
| **[Configure JWKS](./WorkOS-migration/setup/CORRECT-JWKS-CONFIG.md)**      | Set up Neon Auth                     | 🟡 Medium    |
| **[Add Role-Based Access](./02-core-systems/authentication/02-role-management.md)** | Implement RBAC                       | 🟡 Medium    |
| **[Process Refunds](./02-core-systems/payments/08-policy-v3-customer-first-100-refund.md)** | Handle customer refunds              | 🟢 Easy      |
| **[Integrate Multibanco](./02-core-systems/payments/06-multibanco-integration.md)** | Add Portuguese payment method        | 🔴 Advanced  |
| **[Setup Notifications](./02-core-systems/notifications/04-novu-framework-setup.md)** | Configure Novu workflows             | 🟡 Medium    |
| **[Deploy to Production](./08-deployment/README.md)**                      | Deploy application safely            | 🔴 Advanced  |
| **[Troubleshoot Auth](./WorkOS-migration/setup/TROUBLESHOOT-NEON-JWKS.md)** | Fix authentication issues            | 🟡 Medium    |
| **[Cache Optimization](./02-core-systems/caching/01-redis-caching.md)**    | Improve performance with Redis       | 🟡 Medium    |
| **[Core Web Vitals Optimization](./04-development/standards/06-core-web-vitals-optimization.md)** | Fix CLS, LCP, FCP issues | 🟡 Medium    |

---

### 3. Reference (Information-Oriented)

**Goal:** Provide accurate technical specifications

| Reference                                                                  | Description                          | Type         |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------ |
| **[WorkOS Authentication](./WorkOS-migration/reference/workos-authentication.md)** | JWT, OAuth, sessions                 | Auth Spec    |
| **[Org-Per-User Model](./WorkOS-migration/reference/org-per-user-model.md)** | Multi-tenancy architecture           | Architecture |
| **[Row-Level Security](./WorkOS-migration/reference/neon-auth-rls.md)**   | RLS policies and implementation      | Database     |
| **[Encryption Architecture](./03-infrastructure/ENCRYPTION-ARCHITECTURE.md)** | WorkOS Vault, Bun.CryptoHasher       | Security     |
| **[Bun Runtime](./03-infrastructure/BUN-RUNTIME-MIGRATION.md)**           | Bun 1.3.4, crypto migration          | Infrastructure |
| **[Subscription Pricing](../.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md)** | Pricing tiers and calculations       | Business     |
| **[Role Progression](./02-core-systems/ROLE-PROGRESSION-SYSTEM.md)**       | Expert tier system                   | Business     |
| **[Stripe Integration](./02-core-systems/payments/02-stripe-integration.md)** | Payment API reference                | Payments     |
| **[Database Schema](./WorkOS-migration/reference/)**                       | Table definitions and relationships  | Database     |
| **[Agent Skills Reference](./09-integrations/AGENT-SKILLS-REFERENCE.md)** | 24 skills + 8 rules mapped to code  | Development  |

---

### 4. Explanation (Understanding-Oriented)

**Goal:** Explain design decisions and concepts

| Explanation                                                                | Topic                                | Level        |
| -------------------------------------------------------------------------- | ------------------------------------ | ------------ |
| **[Why Organization-Owned Subscriptions](../.cursor/plans/subscription-billing-entity-analysis.md)** | Industry standards and rationale     | 🟡 Intermediate |
| **[Audit Logging Strategy](./WorkOS-migration/reference/unified-audit-logging.md)** | Security and compliance              | 🟡 Intermediate |
| **[Payment Flow Design](./02-core-systems/payments/01-payment-flow-analysis.md)** | Architecture decisions               | 🟡 Intermediate |
| **[WorkOS Migration](./WorkOS-migration/reference/workos-migration-runbook.md)** | Why and how we migrated              | 🔴 Advanced  |
| **[Hybrid Pricing Model](../.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md)** | Business model and economics         | 🟢 Beginner  |
| **[Role-Based Progression](./02-core-systems/ROLE-PROGRESSION-SYSTEM.md)** | Expert growth system design          | 🟡 Intermediate |

---

## 🗂️ Documentation Sections

### [01. Getting Started](./01-getting-started/README.md)

**For:** New developers joining the project

**Contents:**
- Development environment setup
- Required tools and dependencies
- Project structure overview
- First steps and tutorials

---

### [02. Core Systems](./02-core-systems/README.md)

**For:** Understanding production-critical systems

**Contents:**
- **Authentication** - WorkOS AuthKit, RBAC, RLS
- **Payments** - Stripe integration, refunds, payouts
- **Notifications** - Novu workflows, multi-channel
- **Caching** - Redis implementation, rate limiting
- **Scheduling** - Appointment booking, calendar sync
- **Subscriptions** - Pricing tiers, billing
- **Role Progression** - Expert tier system

---

### [03. Infrastructure](./03-infrastructure/README.md)

**For:** DevOps and infrastructure management

**Contents:**
- Database (Neon Postgres)
- Caching (Upstash Redis)
- Monitoring (Sentry, Better Stack)
- Analytics (PostHog)
- Email (Resend)
- Storage (Vercel Blob)
- **[Bun Runtime](./03-infrastructure/BUN-RUNTIME-MIGRATION.md)** - Bun 1.3.4 migration and crypto
- **[Encryption Architecture](./03-infrastructure/ENCRYPTION-ARCHITECTURE.md)** - WorkOS Vault, Bun.CryptoHasher

---

### [04. Development](./04-development/README.md)

**For:** Development guidelines and standards

**Contents:**
- Coding standards
- Testing strategies
- Git workflow
- PR guidelines
- Component patterns
- API design

---

### [05. Guides](./05-guides/README.md)

**For:** Step-by-step implementation guides

**Contents:**
- Feature implementation guides
- Migration guides
- Troubleshooting guides
- Best practices

---

### [06. Legal](./06-legal/README.md)

**For:** Legal compliance and policies

**Contents:**
- Terms of Service
- Privacy Policy
- HIPAA compliance
- GDPR compliance
- Expert agreements
- Cookie policies

---

### [07. Project Management](./07-project-management/README.md)

**For:** Project planning and tracking

**Contents:**
- Roadmap
- Sprint planning
- Task management
- Release notes

---

### [08. Deployment](./08-deployment/README.md)

**For:** Production deployment processes

**Contents:**
- Deployment checklist
- Environment configuration
- CI/CD pipeline
- Rollback procedures
- Monitoring setup

---

### [09. Integrations](./09-integrations/README.md)

**For:** Third-party service integrations

**Contents:**
- WorkOS authentication
- Stripe payments
- Novu notifications
- Google Calendar
- Resend email
- PostHog analytics
- **[Agent Skills & Cursor Rules Reference](./09-integrations/AGENT-SKILLS-REFERENCE.md)** - 24 AI skills + 8 rules mapped to the codebase

---

### [WorkOS Migration](./WorkOS-migration/README.md)

**For:** Understanding authentication system

**Status:** ✅ Migration Complete

**Contents:**
- Getting started tutorial
- Architecture reference
- Setup guides
- Troubleshooting
- Migration history

---

## 🎯 Find What You Need

### By Role

**I'm a Frontend Developer:**
- [Component Patterns](./04-development/README.md)
- [Role Management UI](./02-core-systems/authentication/02-role-management.md)
- [Payment Flow](./02-core-systems/payments/README.md)

**I'm a Backend Developer:**
- [WorkOS Authentication](./WorkOS-migration/reference/workos-authentication.md)
- [Database Schema](./WorkOS-migration/reference/)
- [Server Actions](./04-development/README.md)

**I'm a DevOps Engineer:**
- [Infrastructure](./03-infrastructure/README.md)
- [Deployment](./08-deployment/README.md)
- [Monitoring](./03-infrastructure/README.md)

**I'm a Product Manager:**
- [Subscription Pricing](../.cursor/plans/SUBSCRIPTION-PRICING-MASTER.md)
- [Role Progression](./02-core-systems/ROLE-PROGRESSION-SYSTEM.md)
- [Roadmap](./07-project-management/README.md)

---

### By Task

**I need to:**

| Task                            | Start Here                                                       |
| ------------------------------- | ---------------------------------------------------------------- |
| Set up my dev environment       | [Getting Started](./01-getting-started/README.md)                |
| Understand authentication       | [WorkOS Tutorial](./WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md) |
| Add a new payment method        | [Stripe Integration](./02-core-systems/payments/02-stripe-integration.md) |
| Implement a notification        | [Novu Setup](./02-core-systems/notifications/04-novu-framework-setup.md) |
| Fix an authentication bug       | [Troubleshooting](./WorkOS-migration/setup/TROUBLESHOOT-NEON-JWKS.md) |
| Deploy to production            | [Deployment Guide](./08-deployment/README.md)                    |
| Add role-based access           | [RBAC Guide](./02-core-systems/authentication/02-role-management.md) |
| Optimize database queries       | [RLS Guide](./WorkOS-migration/reference/neon-auth-rls.md)       |
| Process a refund                | [Refund Policy](./02-core-systems/payments/08-policy-v3-customer-first-100-refund.md) |

---

## 📊 Documentation Health

### Coverage by System

| System              | Tutorial | How-To | Reference | Explanation | Status   |
| ------------------- | -------- | ------ | --------- | ----------- | -------- |
| **Authentication**  | ✅       | ✅     | ✅        | ✅          | Complete |
| **Payments**        | ✅       | ✅     | ✅        | ✅          | Complete |
| **Notifications**   | ✅       | ✅     | ✅        | ✅          | Complete |
| **Subscriptions**   | ⏳       | ⏳     | ✅        | ✅          | 70% Done |
| **Role Progression** | ⏳       | ⏳     | ✅        | ✅          | 60% Done |
| **Scheduling**      | ✅       | ✅     | ✅        | ⏳          | 80% Done |
| **Caching**         | ⏳       | ✅     | ✅        | ⏳          | 70% Done |

### Recently Updated

- ✅ Dashboard Redesign (Feb 2026) - Role-aware dashboards with Stripe embedded components
- ✅ Server Audit (Feb 2026) - Admin auth hardening, dependency cleanup, config centralization
- ✅ Sentry Observability (Feb 2026) - 64 API routes instrumented with structured logging
- ✅ WorkOS Migration (Feb 2025) - Complete
- ✅ Subscription System (Feb 2025) - Reference complete
- ✅ Core Systems README (Feb 2025) - Updated for WorkOS
- ✅ Master Implementation Plan (Feb 2025) - New

### Needs Attention

- ⏳ Subscription tutorial (Week 1, Feb 2025)
- ⏳ Role progression tutorial (Week 3, Feb 2025)
- ⏳ Caching explanation (Week 4, Feb 2025)

---

## 🤝 Contributing to Docs

### Documentation Standards

1. **Follow Diátaxis**: Choose correct doc type (Tutorial/How-to/Reference/Explanation)
2. **Be Practical**: Include code examples
3. **Stay Current**: Update "Last Updated" dates
4. **Link Properly**: Cross-reference related docs
5. **Test Code**: Verify all examples work

### Adding New Documentation

1. Determine document type (Tutorial/How-to/Reference/Explanation)
2. Place in appropriate section
3. Update this index
4. Add to relevant README files
5. Cross-link with related docs

### Style Guide

**Code Blocks:**
```typescript
// ✅ Good: Include context and comments
export async function getUser(id: string) {
  // Fetch user with org membership
  const user = await db.query.UsersTable.findFirst({
    where: eq(UsersTable.id, id),
    with: { organization: true },
  });
  
  return user;
}

// ❌ Bad: No context or comments
export async function getUser(id: string) {
  return await db.query.UsersTable.findFirst({ where: eq(UsersTable.id, id) });
}
```

**Structure:**
```markdown
# Title

**For:** Target audience  
**Status:** Current state

## Overview
Brief description

## Prerequisites
- What you need to know
- Required tools

## Steps
1. First step
2. Second step

## Verification
How to verify it works

## Troubleshooting
Common issues

## Next Steps
Where to go from here
```

---

## 📞 Getting Help

### Documentation Issues

- **Can't find what you need?** Check the [search by role](#by-role) or [task](#by-task)
- **Documentation outdated?** Create an issue with label `docs`
- **Want to contribute?** See [Contributing Guidelines](#contributing-to-docs)

### Technical Support

- **Build errors:** Check [Getting Started](./01-getting-started/README.md)
- **Auth issues:** See [WorkOS Troubleshooting](./WorkOS-migration/setup/TROUBLESHOOT-NEON-JWKS.md)
- **Payment issues:** Review [Payment Flow](./02-core-systems/payments/01-payment-flow-analysis.md)
- **General questions:** Contact #engineering on Slack

---

## 🎓 Learning Paths

### Path 1: New Developer (Week 1)

**Goal:** Get productive quickly

- **Day 1:** [Getting Started](./01-getting-started/README.md)
- **Day 2:** [WorkOS Tutorial](./WorkOS-migration/GETTING-STARTED-WITH-WORKOS.md)
- **Day 3:** [Core Systems Overview](./02-core-systems/README.md)
- **Day 4:** [Development Guidelines](./04-development/README.md)
- **Day 5:** Build your first feature

### Path 2: Backend Specialist (Week 2-3)

**Goal:** Master backend systems

- **Week 1:** Authentication (WorkOS, RLS, RBAC)
- **Week 2:** Payments (Stripe, refunds, payouts)
- **Week 3:** Notifications (Novu workflows)

### Path 3: Full Stack (Month 1)

**Goal:** Understand entire platform

- **Week 1:** Authentication & Auth
- **Week 2:** Payments & Subscriptions
- **Week 3:** Notifications & Scheduling
- **Week 4:** Testing & Deployment

---

## 📈 Documentation Metrics

**Total Documents:** 150+  
**Total Sections:** 9  
**Last Major Update:** February 24, 2026  
**Documentation Coverage:** 85%

**Most Viewed:**
1. WorkOS Tutorial (1,200 views)
2. Payment Flow (800 views)
3. Getting Started (650 views)
4. Stripe Integration (500 views)
5. RBAC Guide (400 views)

---

**Maintained By:** Engineering Team  
**Last Updated:** February 24, 2026  
**Status:** ✅ Active & Well-Maintained

---

**Ready to start?** Go to [Getting Started](./01-getting-started/README.md) →
