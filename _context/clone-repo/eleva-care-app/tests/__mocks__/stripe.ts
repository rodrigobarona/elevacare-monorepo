// Mock for Stripe module - Vitest compatible
import { vi } from 'vitest';

const stripeMock = vi.fn(() => {
  return {
    // Products API
    products: {
      create: vi.fn().mockResolvedValue({ id: 'prod_mock123' }),
      update: vi.fn().mockResolvedValue({ id: 'prod_mock123', active: false }),
      retrieve: vi.fn().mockResolvedValue({ id: 'prod_mock123' }),
    },
    // Prices API
    prices: {
      create: vi.fn().mockResolvedValue({ id: 'price_mock123' }),
      update: vi.fn().mockResolvedValue({ id: 'price_mock123' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'price_mock123' }),
    },
    // Customers API
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_mock123' }),
      update: vi.fn().mockResolvedValue({ id: 'cus_mock123' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'cus_mock123' }),
    },
    // Payment Intents
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: 'pi_mock123', client_secret: 'secret_mock' }),
      retrieve: vi.fn().mockResolvedValue({ id: 'pi_mock123', status: 'succeeded' }),
    },
    // Checkout Sessions
    checkout: {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'cs_mock123', url: 'https://example.com/checkout' }),
        retrieve: vi.fn().mockResolvedValue({ id: 'cs_mock123', payment_status: 'paid' }),
      },
    },
    // Account
    accounts: {
      retrieve: vi.fn().mockResolvedValue({ id: 'acct_mock123' }),
    },
  };
});

// Add necessary config properties
(stripeMock as unknown as { LatestApiVersion: string }).LatestApiVersion = '2025-07-30.basil';

export default stripeMock;
