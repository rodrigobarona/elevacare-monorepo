# Testing Strategy & Configuration

> **Last Updated**: December 2024  
> **Test Framework**: Vitest 4.x + Playwright 1.x

This document covers the complete testing strategy for the Eleva.Care application, including configuration, best practices, and a roadmap for future tests.

## Table of Contents

1. [Overview](#overview)
2. [Test Stack](#test-stack)
3. [Directory Structure](#directory-structure)
4. [Configuration](#configuration)
5. [Writing Tests](#writing-tests)
6. [Running Tests](#running-tests)
7. [CI/CD Integration](#cicd-integration)
8. [Best Practices](#best-practices)
9. [Test Coverage Roadmap](#test-coverage-roadmap)

---

## Overview

The Eleva.Care testing strategy follows a **testing pyramid** approach:

```
        /\          E2E Tests (Playwright)
       /  \         - Critical user flows
      /----\        - Cross-browser testing
     /      \
    /--------\      Integration Tests (Vitest)
   /          \     - Service interactions
  /------------\    - API testing
 /              \
/----------------\  Unit Tests (Vitest)
                    - Functions, utilities
                    - Component logic
```

### Key Principles

1. **Server-First Testing**: Focus on testing server components, actions, and APIs
2. **Realistic Mocking**: Use MSW patterns for API mocking when needed
3. **Test Isolation**: Each test runs independently with clean state
4. **CI Integration**: All tests run on every PR via GitHub Actions

---

## Test Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **Vitest** | Unit & Integration testing | 4.x |
| **Playwright** | E2E testing | 1.x |
| **Testing Library** | Component testing utilities | 16.x |
| **MSW** | API mocking (optional) | 2.x |
| **c8/v8** | Code coverage | Built-in |

### Why Vitest over Jest?

- **Native ESM support**: Works seamlessly with Next.js 16
- **Faster execution**: Vite-powered, instant HMR
- **Better TypeScript**: First-class TypeScript support
- **Jest compatibility**: Easy migration with similar API
- **Watch mode**: Smart test filtering in development

---

## Directory Structure

```
tests/
├── __mocks__/              # Shared mock implementations
│   ├── @novu/
│   ├── @upstash/
│   ├── @workos-inc/
│   ├── next-intl.ts
│   ├── next-mdx-remote.ts
│   └── stripe.ts
├── api/                    # API route tests
│   ├── create-payment-intent.test.ts
│   ├── getValidTimesFromSchedule.test.ts
│   └── webhooks/
├── components/             # React component tests
│   ├── ProfilePublishToggle.test.tsx
│   └── MeetingForm.test.tsx
├── deprecated/             # Archived tests (for reference)
├── e2e/                    # Playwright E2E tests
│   ├── auth.spec.ts
│   ├── booking.spec.ts
│   ├── homepage.spec.ts
│   ├── security.spec.ts
│   └── stripe-webhooks.spec.ts
├── integration/            # Integration tests
│   ├── services/           # Service-level tests
│   │   ├── email.test.ts
│   │   ├── keep-alive.test.ts
│   │   ├── locale-detection.test.ts
│   │   └── redis.test.ts
│   ├── availability-management.test.ts
│   ├── expert-onboarding.test.ts
│   └── novu-workflow-execution.test.ts
├── lib/                    # Utility/library tests
│   ├── formatters.test.ts
│   ├── stripe.test.ts
│   └── utils.test.ts
├── mocks/                  # Test data factories
├── server/                 # Server action tests
│   └── actions/
│       ├── events.test.ts
│       ├── expert-profile.test.ts
│       ├── meetings.test.ts
│       └── stripe.test.ts
├── setup.ts                # Global test setup
├── tsconfig.json           # Test-specific TypeScript config
└── mocks.d.ts              # Mock type declarations
```

---

## Configuration

### Vitest Configuration (`vitest.config.mts`)

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Global test API (vi, describe, it, expect)
    globals: true,
    
    // Include patterns
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'tests/deprecated/**',
      'tests/e2e/**',  // E2E tests run via Playwright
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      include: [
        'src/app/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/server/**/*.{ts,tsx}',
      ],
    },
    
    // Performance
    pool: 'threads',
    
    // Mock behavior
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Path aliases (must match tsconfig)
    alias: {
      '@/drizzle/': path.resolve(__dirname, './drizzle') + '/',
      '@/drizzle': path.resolve(__dirname, './drizzle'),
      '@/': path.resolve(__dirname, './src') + '/',
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Playwright Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Test Setup (`tests/setup.ts`)

The setup file configures:

1. **Global Mocks**: Next.js APIs, Drizzle ORM, WorkOS, Stripe
2. **Environment Polyfills**: TextEncoder/TextDecoder for Node.js
3. **Test Lifecycle**: beforeAll, afterAll, beforeEach hooks
4. **Console Suppression**: Clean test output

```typescript
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue({ value: 'mock-cookie' }),
  })),
}));

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => mockStripeInstance),
}));

// Mock Drizzle DB
vi.mock('@/drizzle/db', () => ({ db: mockDb }));

// Mock WorkOS
vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(() => Promise.resolve({ user, sessionId })),
}));
```

---

## Writing Tests

### Unit Test Example

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';

describe('formatCurrency', () => {
  it('formats EUR correctly', () => {
    expect(formatCurrency(1000, 'EUR')).toBe('€10.00');
  });

  it('handles zero amount', () => {
    expect(formatCurrency(0, 'EUR')).toBe('€0.00');
  });
});
```

### Server Action Test Example

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Use vi.hoisted for mocks used in vi.mock factories
const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  withAuth: vi.fn(),
}));

vi.mock('@/drizzle/db', () => ({
  db: { query: mocks.dbQuery },
}));

vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: mocks.withAuth,
}));

import { createEvent } from '@/server/actions/events';

describe('createEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ user: { id: 'user_123' } });
  });

  it('creates event with valid data', async () => {
    mocks.dbQuery.insert.mockResolvedValue([{ id: 'event_123' }]);
    
    const result = await createEvent({ name: 'Test Event' });
    
    expect(result.success).toBe(true);
    expect(result.event.id).toBe('event_123');
  });
});
```

### E2E Test Example (Playwright)

```typescript
import { expect, test } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('user can view expert profile', async ({ page }) => {
    await page.goto('/experts');
    await expect(page.locator('main')).toBeVisible();
    
    // Click on first expert
    await page.locator('[data-testid="expert-card"]').first().click();
    
    // Verify profile page loaded
    await expect(page.locator('h1')).toContainText('Expert');
  });
});
```

---

## Running Tests

### NPM Scripts

```bash
# Unit & Integration tests (Vitest)
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage report
pnpm test:ui           # Vitest UI

# E2E tests (Playwright)
pnpm test:e2e          # Run all E2E tests
pnpm test:e2e:ui       # Playwright UI mode
pnpm test:e2e:headed   # Run with visible browser

# Specific tests
pnpm test tests/server/actions  # Run specific directory
pnpm test MyComponent.test.tsx  # Run specific file
```

### Running in CI

Tests run automatically on every PR via GitHub Actions:

1. **Unit/Integration tests**: Run in parallel on Node.js
2. **E2E tests**: Run on multiple browsers
3. **Coverage**: Uploaded to Codecov

---

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test.yml`)

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: npx playwright install --with-deps
      - run: pnpm test:e2e
```

---

## Best Practices

### 1. Use `vi.hoisted()` for Mock Setup

```typescript
// ✅ Correct - mocks are hoisted before vi.mock()
const mocks = vi.hoisted(() => ({
  myFn: vi.fn(),
}));

vi.mock('@/module', () => ({
  myFn: mocks.myFn,
}));

// ❌ Wrong - will cause "Cannot access before initialization"
const myFn = vi.fn();
vi.mock('@/module', () => ({ myFn }));
```

### 2. Mock Stripe with Default Export

```typescript
// Stripe uses default export, must be mocked correctly
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    customers: { create: vi.fn() },
    paymentIntents: { create: vi.fn() },
  })),
}));
```

### 3. Test Error Cases

```typescript
it('handles database errors gracefully', async () => {
  mocks.dbQuery.mockRejectedValue(new Error('Connection failed'));
  
  const result = await myAction();
  
  expect(result.error).toBe(true);
  expect(result.code).toBe('UNEXPECTED_ERROR');
});
```

### 4. Use Test Factories for Data

```typescript
// tests/mocks/factories.ts
export const createMockUser = (overrides = {}) => ({
  id: 'user_123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  ...overrides,
});

// Usage in tests
const user = createMockUser({ firstName: 'Custom' });
```

### 5. Await Async Operations Properly

```typescript
// ✅ Correct
await act(async () => {
  fireEvent.click(button);
});
await waitFor(() => {
  expect(mocks.myAction).toHaveBeenCalled();
});

// ❌ Wrong - may cause flaky tests
fireEvent.click(button);
expect(mocks.myAction).toHaveBeenCalled();
```

---

## Test Coverage Roadmap

See the detailed roadmap in the next section: [Test Coverage Roadmap](./testing-roadmap.md)

---

## Related Documentation

- [Testing Roadmap](./testing-roadmap.md) - Future test priorities
- [CI/CD Pipeline](../08-deployment/ci-cd.md) - Deployment automation
- [Database Security](../06-legal/database-security.md) - Security testing

