# Test Coverage Report

> **Last Updated**: December 2025  
> **Framework**: Vitest 4.x + Playwright 1.x  
> **Runtime**: Bun (local) / Node.js 24.x (CI/Vercel)  
> **Total Tests**: 243 unit/integration + 5 E2E suites

## Quick Reference

```bash
# Run all unit/integration tests (uses Vitest)
bun run test

# Run with coverage report
bun run test:coverage

# Run in watch mode
bun run test:watch

# Run E2E tests (uses Playwright)
bun run test:e2e
```

> **Note**: Use `bun run test` (which runs Vitest), not `bun test` (Bun's built-in runner).

---

## Test Results Summary

### Unit & Integration Tests (Vitest)

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| **Server Actions** | 4 | 32 | ✅ Passing |
| **API Routes** | 3 | 28 | ✅ Passing |
| **Components** | 3 | 24 | ✅ Passing |
| **Integration** | 7 | 89 | ✅ Passing |
| **Libraries** | 7 | 70 | ✅ Passing |
| **Total** | 25 | 243 | ✅ All Passing |

### E2E Tests (Playwright)

| Suite | Tests | Browsers | Status |
|-------|-------|----------|--------|
| Homepage | 4 | Chromium, Firefox, WebKit | ✅ |
| Authentication | 6 | Chromium, Firefox, WebKit | ✅ |
| Booking Flow | 4 | Chromium, Firefox, WebKit | ✅ |
| Security | 8 | Chromium, Firefox, WebKit | ✅ |
| Stripe Webhooks | 12 | Chromium | ✅ |

---

## Test File Index

### Server Actions (`tests/server/actions/`)

| File | Description | Coverage |
|------|-------------|----------|
| `events.test.ts` | Event CRUD operations | High |
| `expert-profile.test.ts` | Profile publishing toggle | High |
| `meetings.test.ts` | Meeting creation and validation | High |
| `stripe.test.ts` | Stripe integration actions | Medium |

### API Routes (`tests/api/`)

| File | Description | Coverage |
|------|-------------|----------|
| `create-payment-intent.test.ts` | Payment intent creation | High |
| `getValidTimesFromSchedule.test.ts` | Scheduling logic | High |
| `webhooks/blocked-date-refund.test.ts` | Refund webhook handling | Medium |

### Components (`tests/components/`)

| File | Description | Coverage |
|------|-------------|----------|
| `ProfilePublishToggle.test.tsx` | Profile publish/unpublish UI | High |
| `MeetingForm.test.tsx` | Booking form interactions | Medium |
| `analytics-integration.test.tsx` | Analytics tracking | Medium |

### Integration (`tests/integration/`)

| File | Description | Coverage |
|------|-------------|----------|
| `availability-management.test.ts` | Expert availability CRUD | High |
| `expert-onboarding.test.ts` | Onboarding flow | High |
| `novu-workflow-execution.test.ts` | Notification workflows | High |
| `services/email.test.ts` | Email service | High |
| `services/keep-alive.test.ts` | Health check services | High |
| `services/locale-detection.test.ts` | i18n detection | High |
| `services/redis.test.ts` | Redis caching | Medium |
| `services/og-images.test.ts` | OG image generation | Medium |
| `services/env-visibility.test.ts` | Environment security | Medium |

### Library Utils (`tests/lib/`)

| File | Description | Coverage |
|------|-------------|----------|
| `formatters.test.ts` | Currency, date formatters | High |
| `utils.test.ts` | General utilities | High |
| `stripe.test.ts` | Stripe helpers | High |
| `transfer-utils.test.ts` | Transfer calculations | High |
| `redis-object-handling.test.ts` | Redis serialization | High |
| `novu-workflow-fix.test.ts` | Novu workflow helpers | Medium |

### E2E (`tests/e2e/`)

| File | Description |
|------|-------------|
| `auth.spec.ts` | Authentication flows |
| `booking.spec.ts` | Booking user journey |
| `homepage.spec.ts` | Homepage accessibility |
| `security.spec.ts` | Security headers, CSP |
| `stripe-webhooks.spec.ts` | Webhook endpoint testing |

---

## Mock Configuration

### Global Mocks (`tests/setup.ts`)

The setup file provides mocks for:

- **Next.js APIs**: `headers()`, `cookies()`, `NextRequest`, `NextResponse`
- **Database**: Drizzle ORM with query mocking
- **Authentication**: WorkOS AuthKit
- **Payments**: Stripe SDK
- **Caching**: Next.js cache functions

### Manual Mocks (`tests/__mocks__/`)

| Mock | Purpose |
|------|---------|
| `@novu/framework.ts` | Novu notification mocks |
| `@upstash/qstash.ts` | QStash job queue mocks |
| `@upstash/redis.ts` | Redis client mocks |
| `@workos-inc/authkit-nextjs.ts` | WorkOS auth mocks |
| `next-intl.ts` | i18n translation mocks |
| `next-mdx-remote.ts` | MDX rendering mocks |
| `stripe.ts` | Stripe API mocks |

---

## Running Specific Tests

```bash
# Run a single test file
bun run test tests/server/actions/meetings.test.ts

# Run tests matching a pattern
bun run test -- --grep "createMeeting"

# Run tests in a directory
bun run test tests/lib/

# Run with verbose output
bun run test -- --reporter=verbose

# Run failed tests only
bun run test -- --failed
```

---

## Coverage Report

Generate coverage reports:

```bash
bun run test:coverage
```

Coverage output locations:
- **Text**: Terminal output
- **HTML**: `coverage/index.html`
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info`

### Coverage Thresholds (Target)

| Metric | Current | Target |
|--------|---------|--------|
| Lines | ~40% | 80% |
| Functions | ~35% | 80% |
| Branches | ~30% | 70% |
| Statements | ~40% | 80% |

---

## Deprecated Tests

Tests in `tests/deprecated/` are kept for reference but excluded from the test run:

| File | Reason |
|------|--------|
| `stripe.test.ts` | Complex webhook mocking needs rewrite |
| `stripe-connect.test.ts` | Needs update for new Stripe API |
| `stripe-identity.test.ts` | Better suited for E2E |
| `audit-error-handling.test.ts` | Old separate audit DB |
| `audit-non-blocking.test.ts` | Migrated to unified audit |
| `server-mdx.test.ts` | MDX module paths changed |

---

## CI/CD Integration

Tests run on every PR via GitHub Actions:

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun test
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps
      - run: bun run test:e2e
```

---

## Troubleshooting

### Common Issues

**1. Mock not working**
```typescript
// ✅ Use vi.hoisted for mocks in vi.mock factories
const mocks = vi.hoisted(() => ({
  myFn: vi.fn(),
}));
```

**2. Path alias errors**
```typescript
// Ensure vitest.config.mts has correct aliases
alias: {
  '@/': path.resolve(__dirname, './src') + '/',
}
```

**3. ESM issues with Stripe**
```typescript
// Mock Stripe with default export
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripe),
}));
```

**4. Component test hydration warnings**
```typescript
// Suppress in beforeEach
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
```

---

## Related Documentation

- [Testing Strategy](../_docs/04-development/testing-strategy.md)
- [Testing Roadmap](../_docs/04-development/testing-roadmap.md)
- [CI/CD Pipeline](../_docs/08-deployment/ci-cd.md)
