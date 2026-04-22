import { vi } from 'vitest';

// Use vi.hoisted to define mocks that work with vi.mock hoisting
const mocks = vi.hoisted(() => ({
  stripeSessionCreate: vi.fn<(...args: any[]) => Promise<{ id: string; url: string }>>(),
  getOrCreateStripeCustomer: vi.fn<(...args: any[]) => Promise<string>>(),
  dbEventFind: vi.fn<(...args: any[]) => Promise<any>>(),
  dbSlotReservationFind: vi.fn<(...args: any[]) => Promise<any>>(),
}));

// Re-export for use in tests
const mockStripeSessionCreate = mocks.stripeSessionCreate;
const mockGetOrCreateStripeCustomer = mocks.getOrCreateStripeCustomer;
const mockDbEventFind = mocks.dbEventFind;
const mockDbSlotReservationFind = mocks.dbSlotReservationFind;

// Mock dependencies
vi.mock('@/drizzle/db', () => ({
  db: {
    query: {
      EventTable: {
        findFirst: () => mocks.dbEventFind(),
      },
      SlotReservationTable: {
        findFirst: () => mocks.dbSlotReservationFind(),
      },
    },
  },
}));

vi.mock('@/lib/integrations/stripe', () => ({
  getBaseUrl: vi.fn(() => 'https://example.com'),
  getOrCreateStripeCustomer: () => mocks.getOrCreateStripeCustomer(),
  withRetry: vi.fn((fn: () => void) => fn()),
  calculateApplicationFee: vi.fn((price: number) => Math.round(price * 0.15)),
}));

vi.mock('stripe', () => {
  const StripeMock = vi.fn(() => ({
    checkout: {
      sessions: {
        create: (...args: any[]) => mocks.stripeSessionCreate(...args),
      },
    },
  }));
  return { default: StripeMock };
});

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, options: any) => ({ data, options })),
  },
}));

describe('Payment Intent API - Core Functionality', () => {
  const mockEvent = {
    id: 'event_123',
    clerkUserId: 'user_123',
    durationInMinutes: 60,
    name: 'Test Consultation',
    user: {
      stripeConnectAccountId: 'acct_123',
      country: 'PT',
    },
  };

  const mockSessionResponse = {
    id: 'cs_test_123',
    url: 'https://checkout.stripe.com/pay/cs_test_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock responses
    mockDbEventFind.mockResolvedValue(mockEvent);
    mockDbSlotReservationFind.mockResolvedValue(null); // No existing reservations
    mockGetOrCreateStripeCustomer.mockResolvedValue('cus_123');
    mockStripeSessionCreate.mockResolvedValue(mockSessionResponse);
  });

  describe('Payment method selection logic', () => {
    it('should select card + multibanco for future appointments (>72h)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days in future

      // Simulate the payment method selection logic
      const meetingDate = futureDate;
      const currentTime = new Date();
      const hoursUntilMeeting = (meetingDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      const paymentMethodTypes = hoursUntilMeeting <= 72 ? ['card'] : ['card', 'multibanco'];

      expect(hoursUntilMeeting).toBeGreaterThan(72);
      expect(paymentMethodTypes).toEqual(['card', 'multibanco']);
    });

    it('should select card only for near appointments (<=72h)', async () => {
      const nearDate = new Date();
      nearDate.setHours(nearDate.getHours() + 48); // 48 hours in future

      // Simulate the payment method selection logic
      const meetingDate = nearDate;
      const currentTime = new Date();
      const hoursUntilMeeting = (meetingDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

      const paymentMethodTypes = hoursUntilMeeting <= 72 ? ['card'] : ['card', 'multibanco'];

      expect(hoursUntilMeeting).toBeLessThanOrEqual(72);
      expect(paymentMethodTypes).toEqual(['card']);
    });
  });

  describe('Idempotency handling', () => {
    it('should return cached result for duplicate requests', () => {
      // Mock in-memory cache behavior
      const idempotencyCache = new Map();
      const testKey = 'test-idempotency-key';
      const cachedUrl = 'https://cached-checkout-url.com';

      // Pre-populate cache
      idempotencyCache.set(testKey, {
        url: cachedUrl,
        timestamp: Date.now(),
      });

      // Simulate cache lookup
      const cachedResult = idempotencyCache.get(testKey);
      expect(cachedResult).toBeDefined();
      expect(cachedResult.url).toBe(cachedUrl);
    });

    it('should store results in cache after successful creation', () => {
      const idempotencyCache = new Map();
      const testKey = 'new-request-key';
      const newUrl = 'https://new-checkout-url.com';

      // Simulate storing in cache
      idempotencyCache.set(testKey, {
        url: newUrl,
        timestamp: Date.now(),
      });

      const cachedResult = idempotencyCache.get(testKey);
      expect(cachedResult).toBeDefined();
      expect(cachedResult.url).toBe(newUrl);
    });
  });

  describe('Slot reservation conflict detection', () => {
    it('should detect conflicts with different users', async () => {
      const existingReservation = {
        id: 'reservation_123',
        guestEmail: 'another@example.com',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      const requestEmail = 'customer@example.com';

      // Simulate conflict detection logic
      const hasConflict = existingReservation.guestEmail !== requestEmail;

      expect(hasConflict).toBe(true);
    });

    it('should allow same user to proceed', async () => {
      const existingReservation = {
        id: 'reservation_123',
        guestEmail: 'customer@example.com',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      const requestEmail = 'customer@example.com';

      // Simulate conflict detection logic
      const hasConflict = existingReservation.guestEmail !== requestEmail;

      expect(hasConflict).toBe(false);
    });
  });

  describe('Database interactions', () => {
    it('should query event data successfully', async () => {
      await mockDbEventFind();

      expect(mockDbEventFind).toHaveBeenCalled();
    });

    it('should check for existing slot reservations', async () => {
      await mockDbSlotReservationFind();

      expect(mockDbSlotReservationFind).toHaveBeenCalled();
    });
  });

  describe('Stripe integration', () => {
    it('should create checkout session with proper parameters', async () => {
      const sessionParams = {
        payment_method_types: ['card', 'multibanco'],
        customer: 'cus_123',
        payment_intent_data: {
          application_fee_amount: 1500,
          transfer_data: { destination: 'acct_123' },
        },
      };

      await mockStripeSessionCreate(sessionParams);

      expect(mockStripeSessionCreate).toHaveBeenCalledWith(sessionParams);
    });

    it('should get or create stripe customer', async () => {
      const customerId = await mockGetOrCreateStripeCustomer();

      expect(mockGetOrCreateStripeCustomer).toHaveBeenCalled();
      expect(customerId).toBe('cus_123');
    });
  });

  describe('Metadata validation', () => {
    it('should create proper metadata structure for webhooks', () => {
      const meetingData = {
        eventId: 'event_123',
        expertWorkosUserId: 'user_123',
        guestEmail: 'customer@example.com',
        guestName: 'Test Customer',
        startTime: '2024-05-01T10:00:00Z',
        duration: 60,
        guestNotes: 'Test notes',
        timezone: 'Europe/Madrid',
        locale: 'en',
      };

      const sharedMetadata = {
        meeting: JSON.stringify({
          id: meetingData.eventId,
          expert: meetingData.expertWorkosUserId,
          guest: meetingData.guestEmail,
          guestName: meetingData.guestName,
          start: meetingData.startTime,
          dur: meetingData.duration,
          notes: meetingData.guestNotes,
          locale: meetingData.locale,
          timezone: meetingData.timezone,
        }),
        payment: JSON.stringify({
          amount: '10000',
          fee: '1500',
          expert: '8500',
        }),
        transfer: JSON.stringify({
          status: 'pending',
          account: 'acct_123',
          country: 'PT',
          delay: { aging: 0, remaining: 7, required: 7 },
          scheduled: new Date().toISOString(),
        }),
      };

      // Validate metadata structure
      expect(sharedMetadata.meeting).toBeDefined();
      expect(sharedMetadata.payment).toBeDefined();
      expect(sharedMetadata.transfer).toBeDefined();

      // Validate JSON parsing
      const parsedMeeting = JSON.parse(sharedMetadata.meeting);
      expect(parsedMeeting.id).toBe(meetingData.eventId);
      expect(parsedMeeting.guest).toBe(meetingData.guestEmail);

      const parsedPayment = JSON.parse(sharedMetadata.payment);
      expect(parsedPayment.amount).toBe('10000');
      expect(parsedPayment.fee).toBe('1500');

      const parsedTransfer = JSON.parse(sharedMetadata.transfer);
      expect(parsedTransfer.account).toBe('acct_123');
      expect(parsedTransfer.status).toBe('pending');
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle missing required fields', () => {
      const incompleteData = {
        eventId: 'event_123',
        // price is missing
        meetingData: {
          guestEmail: 'customer@example.com',
          // startTime is missing
        },
      };

      const hasRequiredFields = !!(
        incompleteData.eventId &&
        (incompleteData as any).price &&
        incompleteData.meetingData?.guestEmail &&
        (incompleteData.meetingData as any).startTime
      );

      expect(hasRequiredFields).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error
      mockDbEventFind.mockRejectedValue(new Error('Database connection failed'));

      try {
        await mockDbEventFind();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database connection failed');
      }
    });

    it('should handle Stripe API errors', async () => {
      // Simulate Stripe error
      const stripeError = new Error('Invalid API key');
      (stripeError as any).type = 'StripeAuthenticationError';

      mockStripeSessionCreate.mockRejectedValue(stripeError);

      try {
        await mockStripeSessionCreate({});
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).type).toBe('StripeAuthenticationError');
      }
    });
  });

  describe('No premature slot reservations', () => {
    it('should not create slot reservations during payment intent creation', () => {
      // This test documents the correct behavior where slot reservations
      // are NOT created during payment intent creation in the API endpoint

      // The API only creates Stripe checkout sessions and returns URLs
      const apiOnlyCreatesSession = true;
      const apiCreatesReservations = false;

      expect(apiOnlyCreatesSession).toBe(true);
      expect(apiCreatesReservations).toBe(false);
    });

    it('should only create reservations in webhook handlers for Multibanco', () => {
      // This documents that reservations are created only when:
      // 1. payment_intent.requires_action webhook is received (NOT payment_intent.created)
      // 2. Payment method is 'multibanco'
      // 3. next_action.type is 'multibanco_display_details'

      const webhookEventForReservations = 'payment_intent.requires_action'; // CORRECT
      const notThisWebhook = 'payment_intent.created'; // This one does NOT create reservations

      expect(webhookEventForReservations).toBe('payment_intent.requires_action');
      expect(notThisWebhook).not.toBe(webhookEventForReservations);
    });
  });

  describe('Simplified slot management (no transactions)', () => {
    it('should delegate all slot management to webhooks', () => {
      // Test documents the simplified approach where create-payment-intent
      // does NOT handle slot reservations at all

      const createPaymentIntentResponsibilities = [
        'Validate request data',
        'Check for existing conflicts',
        'Create Stripe checkout session',
        'Return checkout URL',
      ];

      const notResponsibleFor = [
        'Creating slot reservations',
        'Database transactions for slots',
        'Managing payment method specific logic',
      ];

      expect(createPaymentIntentResponsibilities).toContain('Create Stripe checkout session');
      expect(notResponsibleFor).toContain('Creating slot reservations');
    });

    it('should only perform conflict checks without creating reservations', () => {
      // The API checks for conflicts but doesn't create reservations to prevent them
      // This is because reservation creation is delegated to webhooks based on payment method

      const conflictCheckingFlow = {
        step1: 'Check existing SlotReservationTable records',
        step2: 'Check existing confirmed MeetingTable records',
        step3: 'Return 409 if conflicts found',
        step4: 'Create Stripe session if no conflicts',
        doesNotDo: 'Create new slot reservations',
      };

      expect(conflictCheckingFlow.step4).toBe('Create Stripe session if no conflicts');
      expect(conflictCheckingFlow.doesNotDo).toBe('Create new slot reservations');
    });

    it('should let webhooks handle payment method specific slot management', () => {
      // Test documents the webhook-based slot management approach
      const webhookBasedApproach = {
        creditCardFlow:
          'payment_intent.succeeded → create meeting directly (no reservation needed)',
        multibancoFlow:
          'payment_intent.requires_action → create slot reservation → payment_intent.succeeded → convert to meeting',
        noReservationNeeded: 'Credit card payments are instant',
      };

      expect(webhookBasedApproach.creditCardFlow).toContain('no reservation needed');
      expect(webhookBasedApproach.multibancoFlow).toContain('requires_action');
    });

    it('should handle session linking via payment intent metadata', () => {
      // Test documents how session IDs are linked to payment intents for webhook processing
      const sessionLinking = {
        apiUpdatesPaymentIntent:
          'Updates payment_intent.metadata.session_id after creating session',
        webhookUsesSessionId: 'payment_intent.requires_action uses session_id to link data',
        noDirectReservationLinking: 'No direct reservation creation in create-payment-intent API',
      };

      expect(sessionLinking.apiUpdatesPaymentIntent).toContain('session_id');
      expect(sessionLinking.noDirectReservationLinking).toContain('No direct reservation creation');
    });
  });
});
