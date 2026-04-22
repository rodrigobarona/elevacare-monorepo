# Test Coverage Roadmap

> **Last Updated**: December 2024  
> **Current Coverage**: ~40% of critical paths  
> **Target Coverage**: 80% of critical paths by Q2 2025

This document outlines the testing priorities based on the current codebase analysis.

## Table of Contents

1. [Current Test Coverage](#current-test-coverage)
2. [Priority Matrix](#priority-matrix)
3. [Phase 1: Critical Path Testing](#phase-1-critical-path-testing)
4. [Phase 2: Business Logic Testing](#phase-2-business-logic-testing)
5. [Phase 3: Integration Testing](#phase-3-integration-testing)
6. [Phase 4: Security Testing](#phase-4-security-testing)
7. [Testing Debt](#testing-debt)

---

## Current Test Coverage

### ✅ Already Tested

| Area | Files | Coverage |
|------|-------|----------|
| **Server Actions** | `events.ts`, `expert-profile.ts`, `meetings.ts`, `stripe.ts` | Unit tests |
| **API Routes** | `create-payment-intent`, `scheduling` | Unit tests |
| **Components** | `ProfilePublishToggle`, `MeetingForm` | Component tests |
| **Utilities** | `formatters`, `utils`, `stripe`, `transfer-utils` | Unit tests |
| **Integration** | Email, Redis, Locale detection, Keep-alive, Novu | Integration tests |
| **E2E** | Auth, Booking, Homepage, Security, Stripe webhooks | Playwright |

### ❌ Not Yet Tested

| Area | Priority | Risk |
|------|----------|------|
| Billing & Subscriptions | 🔴 Critical | Payment failures |
| Blocked Dates | 🟡 High | Scheduling conflicts |
| Commissions | 🔴 Critical | Financial accuracy |
| Eligibility | 🟡 High | Access control |
| Google Calendar | 🟡 High | Calendar sync issues |
| Cron Jobs | 🔴 Critical | Data integrity |
| RBAC/Roles | 🔴 Critical | Security |

---

## Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │   PRIORITY 1      │   PRIORITY 2      │
    │   (Critical)      │   (Important)     │
    │                   │                   │
    │   - Payments      │   - Scheduling    │
    │   - Auth/RBAC     │   - Notifications │
    │   - Cron Jobs     │   - Calendar      │
    │                   │                   │
LOW ├───────────────────┼───────────────────┤ HIGH
FREQ│                   │                   │ FREQUENCY
    │   PRIORITY 4      │   PRIORITY 3      │
    │   (Low)           │   (Medium)        │
    │                   │                   │
    │   - Admin Pages   │   - Profile       │
    │   - Diagnostics   │   - Settings      │
    │   - OG Images     │   - Categories    │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

---

## Phase 1: Critical Path Testing

**Timeline**: Week 1-2  
**Goal**: Test all payment and authentication flows

### 1.1 Server Actions - Billing & Subscriptions

```
src/server/actions/
├── billing.ts           ← Needs tests
├── subscriptions.ts     ← Needs tests
├── commissions.ts       ← Needs tests
└── stripe-pricing.ts    ← Needs tests
```

**Test File**: `tests/server/actions/billing.test.ts`

```typescript
describe('Billing Actions', () => {
  describe('createBillingPortalSession', () => {
    it('creates session for existing customer');
    it('handles missing customer gracefully');
    it('returns error for unauthenticated user');
  });
  
  describe('getSubscriptionStatus', () => {
    it('returns active for paid subscription');
    it('returns trial for trial period');
    it('returns expired for cancelled subscription');
  });
});
```

**Test File**: `tests/server/actions/commissions.test.ts`

```typescript
describe('Commission Actions', () => {
  describe('calculateCommission', () => {
    it('calculates 15% platform fee correctly');
    it('handles EU VAT scenarios');
    it('applies expert tier discounts');
  });
  
  describe('processExpertPayout', () => {
    it('creates payout for verified expert');
    it('blocks payout for unverified expert');
    it('respects minimum payout threshold');
  });
});
```

### 1.2 API Routes - Webhooks

```
src/app/api/webhooks/
├── stripe/
│   ├── handlers/
│   │   ├── payment.ts    ← Needs tests
│   │   ├── payout.ts     ← Needs tests
│   │   └── identity.ts   ← Needs tests
│   └── route.ts
├── workos/
│   └── route.ts          ← Needs tests
└── stripe-subscriptions/
    └── route.ts          ← Needs tests
```

**Test File**: `tests/api/webhooks/workos.test.ts`

```typescript
describe('WorkOS Webhook', () => {
  describe('user.created', () => {
    it('creates user profile in database');
    it('assigns default patient role');
    it('triggers welcome notification');
  });
  
  describe('user.deleted', () => {
    it('anonymizes user data for GDPR');
    it('cancels active subscriptions');
    it('revokes calendar access');
  });
});
```

### 1.3 RBAC & Authentication

```
src/lib/auth/
├── roles.ts              ← Needs tests
├── roles.server.ts       ← Needs tests
├── admin-middleware.ts   ← Needs tests
└── protected-route.ts    ← Needs tests
```

**Test File**: `tests/lib/auth/roles.test.ts`

```typescript
describe('Role-Based Access Control', () => {
  describe('hasRole', () => {
    it('returns true for exact role match');
    it('returns false for missing role');
    it('handles expert_* roles correctly');
  });
  
  describe('requireRole', () => {
    it('allows access for authorized role');
    it('throws for unauthorized role');
    it('handles multiple required roles');
  });
  
  describe('isAdmin', () => {
    it('identifies admin users');
    it('identifies super_admin users');
    it('rejects non-admin users');
  });
});
```

---

## Phase 2: Business Logic Testing

**Timeline**: Week 3-4  
**Goal**: Test core business logic

### 2.1 Scheduling & Availability

```
src/server/actions/
├── schedule.ts           ← Needs more tests
├── blocked-dates.ts      ← Needs tests
└── google-calendar.ts    ← Needs tests

src/lib/utils/server/
└── scheduling.ts         ← Partially tested
```

**Test File**: `tests/server/actions/blocked-dates.test.ts`

```typescript
describe('Blocked Dates Actions', () => {
  describe('addBlockedDate', () => {
    it('blocks single date');
    it('blocks date range');
    it('prevents overlapping blocks');
  });
  
  describe('removeBlockedDate', () => {
    it('removes existing block');
    it('handles non-existent block');
  });
  
  describe('getBlockedDates', () => {
    it('returns all blocked dates for expert');
    it('filters by date range');
  });
});
```

### 2.2 Google Calendar Integration

**Test File**: `tests/lib/integrations/google-calendar.test.ts`

```typescript
describe('Google Calendar Integration', () => {
  describe('syncCalendarEvents', () => {
    it('fetches events from Google Calendar');
    it('handles rate limiting gracefully');
    it('handles expired OAuth tokens');
  });
  
  describe('createCalendarEvent', () => {
    it('creates meeting with correct timezone');
    it('includes video conference link');
    it('handles calendar write errors');
  });
  
  describe('deleteCalendarEvent', () => {
    it('removes cancelled meetings');
    it('handles missing event gracefully');
  });
});
```

### 2.3 Expert Onboarding

```
src/server/actions/
├── expert-setup.ts       ← Needs tests
├── expert-profile.ts     ← Partially tested
├── eligibility.ts        ← Needs tests
└── experts.ts            ← Needs tests
```

**Test File**: `tests/server/actions/expert-setup.test.ts`

```typescript
describe('Expert Setup Actions', () => {
  describe('checkExpertSetupStatus', () => {
    it('returns all steps complete');
    it('identifies missing profile');
    it('identifies missing availability');
    it('identifies missing payment setup');
    it('identifies missing identity verification');
  });
  
  describe('completeSetupStep', () => {
    it('marks step as complete');
    it('triggers next step notification');
    it('unlocks profile publishing');
  });
});
```

---

## Phase 3: Integration Testing

**Timeline**: Week 5-6  
**Goal**: Test service integrations

### 3.1 Cron Jobs (Critical)

```
src/app/api/cron/
├── appointment-reminders/     ← Needs tests
├── check-eligibility/         ← Needs tests
├── cleanup-blocked-dates/     ← Needs tests
├── process-expert-transfers/  ← Needs tests
├── process-pending-payouts/   ← Needs tests
└── send-payment-reminders/    ← Needs tests
```

**Test File**: `tests/api/cron/appointment-reminders.test.ts`

```typescript
describe('Appointment Reminders Cron', () => {
  describe('24-hour reminder', () => {
    it('sends reminder for tomorrow appointments');
    it('skips cancelled appointments');
    it('handles multiple reminders in batch');
  });
  
  describe('1-hour reminder', () => {
    it('sends final reminder');
    it('includes meeting link');
    it('uses correct timezone');
  });
});
```

**Test File**: `tests/api/cron/process-expert-transfers.test.ts`

```typescript
describe('Process Expert Transfers Cron', () => {
  it('processes pending transfers after aging period');
  it('skips transfers with pending refunds');
  it('creates payout to expert bank account');
  it('handles Stripe API failures');
  it('updates transfer status correctly');
});
```

### 3.2 Notification System

```
src/lib/notifications/
├── core.ts               ← Needs tests
├── payment.ts            ← Needs tests
└── index.ts

src/lib/integrations/novu/
├── client.ts             ← Partially tested
├── email.ts              ← Tested
└── utils.ts              ← Needs tests
```

**Test File**: `tests/lib/notifications/core.test.ts`

```typescript
describe('Notification Core', () => {
  describe('sendNotification', () => {
    it('sends to correct channel');
    it('includes all required variables');
    it('handles failed delivery gracefully');
  });
  
  describe('scheduleNotification', () => {
    it('schedules for future delivery');
    it('cancels scheduled notification');
  });
});
```

### 3.3 WorkOS Integration

```
src/lib/integrations/workos/
├── rbac.ts               ← Needs tests
├── roles.ts              ← Needs tests
├── sync.ts               ← Needs tests
├── guest-users.ts        ← Needs tests
├── vault.ts              ← Needs tests
└── auto-organization.ts  ← Needs tests
```

**Test File**: `tests/lib/integrations/workos/rbac.test.ts`

```typescript
describe('WorkOS RBAC', () => {
  describe('assignRole', () => {
    it('assigns role to user');
    it('handles duplicate assignment');
    it('validates role exists');
  });
  
  describe('revokeRole', () => {
    it('removes role from user');
    it('handles missing role gracefully');
  });
  
  describe('checkPermission', () => {
    it('checks role-based permission');
    it('returns false for missing permission');
  });
});
```

---

## Phase 4: Security Testing

**Timeline**: Week 7-8  
**Goal**: Ensure HIPAA/GDPR compliance

### 4.1 Data Protection

**Test File**: `tests/lib/encryption.test.ts`

```typescript
describe('Encryption Utils', () => {
  describe('encryptPHI', () => {
    it('encrypts personal health information');
    it('uses unique IV for each encryption');
    it('produces deterministic output with same key');
  });
  
  describe('decryptPHI', () => {
    it('decrypts encrypted data');
    it('fails on tampered data');
    it('fails with wrong key');
  });
});
```

### 4.2 Audit Logging

**Test File**: `tests/lib/audit.test.ts`

```typescript
describe('Unified Audit Logging', () => {
  describe('logAuditEvent', () => {
    it('logs PHI access events');
    it('includes user context automatically');
    it('captures IP and user agent');
    it('handles logging failures gracefully');
  });
  
  describe('getAuditLogs', () => {
    it('filters by date range');
    it('filters by action type');
    it('respects RLS for org scoping');
  });
  
  describe('exportAuditLogs', () => {
    it('exports to JSON format');
    it('exports to CSV format');
    it('includes all required fields');
  });
});
```

### 4.3 API Security

**Test File**: `tests/e2e/api-security.spec.ts`

```typescript
test.describe('API Security', () => {
  test('rejects requests without authentication', async ({ request }) => {
    const response = await request.get('/api/user/profile');
    expect(response.status()).toBe(401);
  });
  
  test('validates CSRF tokens', async ({ request }) => {
    const response = await request.post('/api/profile', {
      data: { name: 'Test' },
    });
    expect(response.status()).toBe(403);
  });
  
  test('rate limits excessive requests', async ({ request }) => {
    for (let i = 0; i < 100; i++) {
      await request.get('/api/health');
    }
    const response = await request.get('/api/health');
    expect(response.status()).toBe(429);
  });
});
```

---

## Testing Debt

### Tests Moved to Deprecated

These tests need to be rewritten or are no longer relevant:

| File | Reason | Action |
|------|--------|--------|
| `stripe.test.ts` | Complex webhook mocking | Rewrite with MSW |
| `stripe-connect.test.ts` | Outdated API | Update for new Stripe version |
| `stripe-identity.test.ts` | Complex state management | Cover in E2E |
| `audit-error-handling.test.ts` | Old audit system | Use audit-workos.ts |
| `audit-non-blocking.test.ts` | Old audit system | Covered by unified audit |
| `server-mdx.test.ts` | MDX module changed | Update paths |

### Known Issues

1. **Component tests require extensive mocking**: Next.js navigation and i18n require mocking
2. **Stripe webhook tests are complex**: Consider using Stripe CLI for local testing
3. **WorkOS tests need real API calls**: Consider contract testing with Pact

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unit test coverage | ~40% | 80% |
| Integration test coverage | ~30% | 70% |
| E2E critical path coverage | ~50% | 100% |
| Test execution time | ~30s | <60s |
| Flaky test rate | Unknown | <1% |

---

## Related Documentation

- [Testing Strategy](./testing-strategy.md) - Configuration and best practices
- [CI/CD Pipeline](../08-deployment/ci-cd.md) - Automated testing in CI
- [Database Security](../06-legal/database-security.md) - Security requirements

