import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Stripe Connect Webhook Handler Tests
 */

// Use vi.hoisted for mocks that need to be available in vi.mock factories
const mocks = vi.hoisted(() => ({
  stripeConstructEvent: vi.fn(),
  dbUpdate: vi.fn(),
  dbQueryUserTableFindFirst: vi.fn(),
  markStepCompleteForUser: vi.fn(),
}));

// Mock Novu integration
vi.mock('@/app/utils/novu');
vi.mock('@/lib/integrations/novu/utils');

// Mock external dependencies
vi.mock('@/drizzle/db', () => ({
  db: {
    query: {
      UserTable: {
        findFirst: mocks.dbQueryUserTableFindFirst,
      },
    },
    update: mocks.dbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
  },
}));

vi.mock('@/server/actions/expert-setup', () => ({
  markStepCompleteForUser: mocks.markStepCompleteForUser.mockResolvedValue({ success: true }),
}));

vi.mock('stripe', () => {
  const StripeMock = vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mocks.stripeConstructEvent,
    },
  }));
  return { default: StripeMock };
});

// Import after mocks
import { POST } from '@/app/api/webhooks/stripe-connect/route';
import { db } from '@/drizzle/db';

describe('Stripe Connect Webhook Handler', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'test-webhook-secret';
    process.env.STRIPE_SECRET_KEY = 'test-stripe-key';

    // Setup mock request
    mockRequest = {
      text: vi.fn().mockResolvedValue('{"type":"account.updated"}'),
      headers: {
        get: vi.fn().mockReturnValue('test-stripe-signature'),
      },
    } as unknown as NextRequest;

    // Reset db.update mock
    mocks.dbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });
  });

  afterEach(() => {
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe('POST - Request Validation', () => {
    it('should return 500 when STRIPE_CONNECT_WEBHOOK_SECRET is missing', async () => {
      delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Webhook secret not configured');
    });

    it('should return 400 when Stripe signature header is missing', async () => {
      mockRequest = {
        text: vi.fn().mockResolvedValue('{}'),
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No signature');
    });

    it('should return 400 when webhook signature verification fails', async () => {
      mocks.stripeConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Webhook signature verification failed');
    });
  });

  describe('POST - Account Events', () => {
    beforeEach(() => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.updated',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'acct_test_123',
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
            metadata: {
              clerkUserId: 'user_123',
            },
          },
        },
      });
    });

    it('should process account.updated event successfully', async () => {
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('should mark Connect step complete when account is fully verified', async () => {
      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle account.application.deauthorized event', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.application.deauthorized',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'acct_test_123',
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('POST - External Account Events', () => {
    it('should process account.external_account.created event successfully', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.external_account.created',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'ba_test_123',
            account: 'acct_test_123',
            object: 'bank_account',
            country: 'US',
            currency: 'usd',
            last4: '6789',
            bank_name: 'Test Bank',
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });

    it('should process account.external_account.deleted event successfully', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.external_account.deleted',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'ba_test_123',
            account: 'acct_test_123',
            object: 'bank_account',
            deleted: true,
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe('POST - Payout Events', () => {
    it('should handle payout.paid event', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'payout.paid',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'po_test_123',
            destination: 'acct_test_123',
            amount: 5000,
            currency: 'eur',
            arrival_date: Math.floor(Date.now() / 1000) + 86400,
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });

    it('should handle payout.failed event and disable payouts', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'payout.failed',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'po_test_123',
            destination: 'acct_test_123',
            amount: 5000,
            currency: 'eur',
            failure_code: 'account_closed',
            failure_message: 'Bank account is closed',
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('POST - Unsupported Events', () => {
    it('should skip unsupported event types', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'pi_test_123',
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });

  describe('POST - Error Handling', () => {
    beforeEach(() => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.updated',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'acct_test_123',
            metadata: {
              clerkUserId: 'user_123',
            },
          },
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mocks.dbUpdate.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle partial account verification states', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.updated',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'acct_test_123',
            details_submitted: true,
            charges_enabled: false,
            payouts_enabled: false,
            metadata: {
              clerkUserId: 'user_123',
            },
          },
        },
      });

      mocks.dbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle card external accounts', async () => {
      mocks.stripeConstructEvent.mockReturnValue({
        type: 'account.external_account.created',
        id: 'evt_test_123',
        data: {
          object: {
            id: 'card_test_123',
            account: 'acct_test_123',
            object: 'card',
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
    });
  });
});
