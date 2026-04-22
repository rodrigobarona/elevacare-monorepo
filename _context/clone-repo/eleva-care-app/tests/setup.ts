/**
 * Vitest Setup File
 * Global test configuration and mocks for Next.js 16 application
 */
import '@testing-library/jest-dom/vitest';
import { afterAll, beforeAll, vi } from 'vitest';

// Declare types for global mocks
declare global {
  var __mocks: {
    db: unknown;
    workosUser: unknown;
  };
}

// Add required polyfills for TextEncoder/Decoder
if (typeof TextEncoder === 'undefined') {
  // Use synchronous require for Node.js util module
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const util = require('node:util');

  (globalThis as any).TextEncoder = util.TextEncoder;

  (globalThis as any).TextDecoder = util.TextDecoder;
}

// Mock Next.js Web API globals for webhook testing
Object.defineProperty(global, 'Request', {
  value: class MockRequest {
    constructor(
      public url: string,
      public init?: unknown,
    ) {
      this.headers = {
        get: (name: string) => {
          const headers = (this.init as Record<string, unknown>)?.headers || {};
          return (headers as Record<string, unknown>)[name] || null;
        },
      };
    }
    async text() {
      return String((this.init as Record<string, unknown>)?.body || '{}');
    }
    async json() {
      return JSON.parse(await this.text());
    }
    headers: Record<string, unknown>;
  },
  writable: true,
});

Object.defineProperty(global, 'Response', {
  value: class MockResponse {
    constructor(
      public body?: unknown,
      public init?: ResponseInit,
    ) {
      this.status = init?.status || 200;
    }
    async json() {
      return this.body;
    }
    status: number;

    static json(data: unknown, init?: ResponseInit) {
      return new MockResponse(data, init);
    }
  },
  writable: true,
});

// Mock NextResponse specifically for Next.js
vi.mock('next/server', () => ({
  NextRequest: vi.fn().mockImplementation((...args: unknown[]) => {
    const [url, init] = args;
    return new (
      global as unknown as { Request: new (url: string, init?: unknown) => unknown }
    ).Request(url as string, init);
  }),
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      return new (
        global as unknown as { Response: new (data: unknown, init?: ResponseInit) => unknown }
      ).Response(data, init);
    },
    next: () =>
      new (
        global as unknown as { Response: new (data: unknown, init?: ResponseInit) => unknown }
      ).Response(null, { status: 200 }),
    redirect: (url: string) =>
      new (
        global as unknown as { Response: new (data: unknown, init?: ResponseInit) => unknown }
      ).Response(null, { status: 302, headers: { Location: url } }),
  },
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({
    get: vi.fn().mockReturnValue({ value: 'mock-cookie' }),
  })),
}));

// Mock Stripe
vi.mock('stripe', () => {
  const mockStripeInstance = {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_mock' } as never),
      retrieve: vi.fn().mockResolvedValue({ id: 'cus_mock' } as never),
    },
    paymentIntents: {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'pi_mock', client_secret: 'pi_mock_secret' } as never),
      retrieve: vi.fn().mockResolvedValue({ id: 'pi_mock', status: 'succeeded' } as never),
    },
    charges: {
      retrieve: vi.fn().mockResolvedValue({ id: 'ch_mock' } as never),
    },
    checkout: {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'cs_mock', url: 'https://checkout.stripe.com/mock' } as never),
      },
    },
    accounts: {
      create: vi.fn().mockResolvedValue({ id: 'acct_mock' } as never),
      retrieve: vi.fn().mockResolvedValue({ id: 'acct_mock', charges_enabled: true } as never),
    },
    accountLinks: {
      create: vi.fn().mockResolvedValue({ url: 'https://connect.stripe.com/mock' } as never),
    },
    identity: {
      verificationSessions: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'vs_mock', url: 'https://verify.stripe.com/mock' } as never),
        retrieve: vi.fn().mockResolvedValue({ id: 'vs_mock', status: 'verified' } as never),
      },
    },
    events: {
      retrieve: vi
        .fn()
        .mockResolvedValue({ id: 'evt_mock', type: 'payment_intent.succeeded' } as never),
    },
    products: {
      create: vi.fn().mockResolvedValue({ id: 'prod_mock' } as never),
      update: vi.fn().mockResolvedValue({ id: 'prod_mock', active: false } as never),
      retrieve: vi.fn().mockResolvedValue({ id: 'prod_mock' } as never),
    },
    prices: {
      create: vi.fn().mockResolvedValue({ id: 'price_mock' } as never),
      retrieve: vi.fn().mockResolvedValue({ id: 'price_mock' } as never),
    },
  };

  // Return a constructor function that returns the mock
  return { default: vi.fn().mockImplementation(() => mockStripeInstance) };
});

// Mock drizzle to prevent database connections during tests
const mockDb = {
  query: {
    ProfileTable: {
      findFirst: vi.fn(),
    },
    UserTable: {
      findFirst: vi.fn(),
    },
    ScheduleTable: {
      findFirst: vi.fn(),
    },
    EventTable: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: 2 }] as never),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'mock-id' }] as never)),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'mock-id' }] as never)),
      }),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockImplementation(() => Promise.resolve([{ id: 'mock-id' }] as never)),
    }),
  }),
};

// Mock WorkOS user for testing
const mockWorkosUser = {
  object: 'user' as const,
  id: 'user_test123',
  email: 'test@example.com',
  emailVerified: true,
  profilePictureUrl: null,
  firstName: 'Test',
  lastName: 'User',
  lastSignInAt: new Date().toISOString(),
  locale: 'en-US',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  externalId: null,
  metadata: {
    role: 'expert_community', // WorkOS stores role in metadata
  },
};

// Setup Vitest mocks
vi.mock('@/drizzle/db', () => ({
  db: mockDb,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
  and: vi.fn((...conditions) => ({ and: conditions })),
  or: vi.fn((...conditions) => ({ or: conditions })),
  desc: vi.fn((field) => ({ desc: field })),
  count: vi.fn(() => ({ count: true })),
  sql: vi.fn((query) => ({ sql: query })),
  isNull: vi.fn((field) => ({ isNull: field })),
  gt: vi.fn((field, value) => ({ field, value, operator: 'gt' })),
  gte: vi.fn((field, value) => ({ field, value, operator: 'gte' })),
  lt: vi.fn((field, value) => ({ field, value, operator: 'lt' })),
  lte: vi.fn((field, value) => ({ field, value, operator: 'lte' })),
  inArray: vi.fn((field, values) => ({ field, values, operator: 'inArray' })),
  relations: vi.fn(() => ({})),
}));

// Add WorkOS auth mock
// Mock structure matches @workos-inc/authkit-nextjs UserInfo interface
vi.mock('@workos-inc/authkit-nextjs', () => ({
  withAuth: vi.fn(() =>
    Promise.resolve({
      user: {
        object: 'user' as const,
        id: 'user_test123',
        email: 'test@example.com',
        emailVerified: true,
        profilePictureUrl: null,
        firstName: 'Test',
        lastName: 'User',
        lastSignInAt: new Date().toISOString(),
        locale: 'en-US',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        externalId: null,
        metadata: {},
      },
      sessionId: 'session_test123',
      organizationId: 'org_test123',
      accessToken: 'mock_access_token',
      role: undefined,
      roles: [],
      permissions: [],
      entitlements: [],
      featureFlags: [],
      impersonator: undefined,
    } as never),
  ),
  getSignInUrl: vi.fn(() => '/sign-in'),
  getSignUpUrl: vi.fn(() => '/sign-up'),
  getSignOutUrl: vi.fn(() => '/sign-out'),
}));

// Mock WorkOS client-side components
vi.mock('@workos-inc/authkit-nextjs/components', () => ({
  useAuth: vi.fn(() => ({
    user: {
      object: 'user' as const,
      id: 'user_test123',
      email: 'test@example.com',
      emailVerified: true,
      profilePictureUrl: null,
      firstName: 'Test',
      lastName: 'User',
      lastSignInAt: new Date().toISOString(),
      locale: 'en-US',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalId: null,
      metadata: {},
    },
    loading: false,
    isSignedIn: true,
  })),
  AuthKitProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// Make common mocks available to tests
global.__mocks = {
  db: mockDb as never,
  workosUser: mockWorkosUser as never,
};

// Mock Google Calendar
vi.mock('@/server/googleCalendar', () => ({
  createCalendarEvent: vi.fn(),
}));

// Mock schedule validation
vi.mock('@/lib/utils/server/scheduling', () => ({
  getValidTimesFromSchedule: vi.fn().mockResolvedValue([] as never),
}));

// Mock audit logging
vi.mock('@/lib/utils/server/audit', () => ({
  logAuditEvent: vi.fn().mockImplementation(() => Promise.resolve()),
}));

// Add global fetch mock for Stripe
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response),
) as unknown as typeof fetch;

// Suppress console.log statements during tests to keep output clean
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = vi.fn() as typeof console.log;
});

afterAll(() => {
  console.log = originalConsoleLog;
});
