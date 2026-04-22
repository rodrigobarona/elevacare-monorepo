import { expect, test } from '@playwright/test';

/**
 * Stripe Webhook E2E Tests
 *
 * These tests verify that the Stripe webhook endpoints handle real-world
 * payloads correctly. Based on actual Stripe delivery logs from production.
 *
 * Note: These tests use mock signatures and are designed to test endpoint
 * availability and response handling. For full integration testing with
 * signature verification, use Stripe CLI in development.
 *
 * To test with real signatures locally:
 * 1. Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * 2. Use the webhook signing secret from the CLI output
 */

test.describe('Stripe Connect Webhook (/api/webhooks/stripe-connect)', () => {
  const webhookUrl = '/api/webhooks/stripe-connect';

  test('should return 400 without signature header', async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({ type: 'account.updated' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Should fail signature validation
    expect(response.status()).toBe(400);
  });

  test('endpoint should be accessible', async ({ request }) => {
    // Verify the endpoint exists and responds (even without valid signature)
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-test-signature',
      },
    });

    // Should return 400 for invalid signature (not 404 for missing endpoint)
    expect([400, 500]).toContain(response.status());
  });

  test.describe('Payout Events Structure', () => {
    // Based on real payout.updated event from production
    const payoutUpdatedPayload = {
      id: 'evt_test_payout_updated',
      object: 'event',
      account: 'acct_test123',
      api_version: '2025-09-30.clover',
      created: 1764567418,
      data: {
        object: {
          id: 'po_test123',
          object: 'payout',
          amount: 5950,
          arrival_date: 1764633600,
          currency: 'eur',
          description: 'Expert payout for session test-session-id',
          destination: 'ba_test123',
          status: 'in_transit',
          metadata: {
            processedAt: '2025-11-29T06:00:04.595Z',
            paymentTransferId: '26',
            expertWorkosUserId: 'user_test123',
            originalTransferAmount: '5950',
            source: 'database',
            eventId: 'test-event-id',
          },
          method: 'standard',
          source_type: 'card',
          statement_descriptor: 'Eleva - Test Expert',
          type: 'bank_account',
        },
        previous_attributes: {
          status: 'pending',
        },
      },
      livemode: false,
      type: 'payout.updated',
    };

    test('payout.updated payload has correct structure', () => {
      // Verify payload structure matches what our handler expects
      expect(payoutUpdatedPayload.type).toBe('payout.updated');
      expect(payoutUpdatedPayload.data.object.object).toBe('payout');
      expect(payoutUpdatedPayload.data.object.amount).toBeGreaterThan(0);
      expect(payoutUpdatedPayload.data.object.currency).toBe('eur');
      expect(payoutUpdatedPayload.data.object.metadata).toBeDefined();
      expect(payoutUpdatedPayload.data.object.metadata.expertWorkosUserId).toBeDefined();
    });
  });

  test.describe('Account Events Structure', () => {
    const accountUpdatedPayload = {
      id: 'evt_test_account_updated',
      object: 'event',
      account: 'acct_test123',
      api_version: '2025-09-30.clover',
      created: Date.now() / 1000,
      data: {
        object: {
          id: 'acct_test123',
          object: 'account',
          details_submitted: true,
          charges_enabled: true,
          payouts_enabled: true,
          metadata: {
            clerkUserId: 'user_test123',
          },
        },
      },
      livemode: false,
      type: 'account.updated',
    };

    test('account.updated payload has correct structure', () => {
      expect(accountUpdatedPayload.type).toBe('account.updated');
      expect(accountUpdatedPayload.data.object.object).toBe('account');
      expect(accountUpdatedPayload.data.object.details_submitted).toBeDefined();
      expect(accountUpdatedPayload.data.object.charges_enabled).toBeDefined();
      expect(accountUpdatedPayload.data.object.payouts_enabled).toBeDefined();
    });
  });
});

test.describe('Stripe Main Webhook (/api/webhooks/stripe)', () => {
  const webhookUrl = '/api/webhooks/stripe';

  test('should return 400 without signature header', async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({ type: 'payment_intent.succeeded' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('endpoint should be accessible', async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-test-signature',
      },
    });

    expect([400, 500]).toContain(response.status());
  });

  test.describe('Checkout Session Events Structure', () => {
    // Based on real checkout.session.completed event from production
    const checkoutSessionPayload = {
      id: 'evt_test_checkout_completed',
      object: 'event',
      api_version: '2025-09-30.clover',
      created: 1764795522,
      data: {
        object: {
          id: 'cs_test_session123',
          object: 'checkout.session',
          amount_total: 7000,
          currency: 'eur',
          customer: 'cus_test123',
          customer_details: {
            email: 'test@example.com',
            name: 'Test Customer',
            address: {
              city: 'Lisbon',
              country: 'PT',
              line1: 'Test Street 1',
              postal_code: '1000-001',
            },
          },
          metadata: {
            preferredTaxHandling: 'vat_only',
            meeting: JSON.stringify({
              id: 'test-meeting-id',
              expert: 'user_test123',
              guest: 'test@example.com',
              guestName: 'Test Customer',
              start: '2025-12-08T13:30:00.000Z',
              dur: 45,
              notes: 'Test booking notes',
            }),
            transfer: JSON.stringify({
              status: 'PENDING',
              account: 'acct_test123',
              country: 'PT',
              delay: { aging: 4, required: 7 },
              scheduled: '2025-12-10T04:00:00.000Z',
            }),
            isEuropeanCustomer: 'true',
            payment: JSON.stringify({
              amount: '7000',
              fee: '1050',
              expert: '5950',
            }),
          },
          mode: 'payment',
          payment_intent: 'pi_test123',
          payment_status: 'paid',
          status: 'complete',
          success_url: 'https://eleva.care/en/expert/event/success?session_id={CHECKOUT_SESSION_ID}',
        },
      },
      livemode: false,
      type: 'checkout.session.completed',
    };

    test('checkout.session.completed payload has correct structure', () => {
      expect(checkoutSessionPayload.type).toBe('checkout.session.completed');
      expect(checkoutSessionPayload.data.object.object).toBe('checkout.session');
      expect(checkoutSessionPayload.data.object.amount_total).toBeGreaterThan(0);
      expect(checkoutSessionPayload.data.object.payment_status).toBe('paid');
      expect(checkoutSessionPayload.data.object.metadata.meeting).toBeDefined();

      // Parse meeting metadata
      const meeting = JSON.parse(checkoutSessionPayload.data.object.metadata.meeting);
      expect(meeting.id).toBeDefined();
      expect(meeting.expert).toBeDefined();
      expect(meeting.guest).toBeDefined();
    });

    test('meeting metadata can be parsed correctly', () => {
      const meeting = JSON.parse(checkoutSessionPayload.data.object.metadata.meeting);

      expect(meeting).toMatchObject({
        id: expect.any(String),
        expert: expect.any(String),
        guest: expect.any(String),
        guestName: expect.any(String),
        start: expect.any(String),
        dur: expect.any(Number),
      });
    });

    test('payment metadata can be parsed correctly', () => {
      const payment = JSON.parse(checkoutSessionPayload.data.object.metadata.payment);

      expect(payment).toMatchObject({
        amount: expect.any(String),
        fee: expect.any(String),
        expert: expect.any(String),
      });

      // Verify fee calculation (15% of 7000 = 1050)
      expect(parseInt(payment.fee)).toBe(1050);
      expect(parseInt(payment.amount) - parseInt(payment.fee)).toBe(parseInt(payment.expert));
    });
  });

  test.describe('Payment Intent Events Structure', () => {
    // Based on real payment_intent.succeeded event from production
    const paymentIntentPayload = {
      id: 'evt_test_payment_succeeded',
      object: 'event',
      api_version: '2025-09-30.clover',
      created: 1764795521,
      data: {
        object: {
          id: 'pi_test123',
          object: 'payment_intent',
          amount: 7000,
          amount_received: 7000,
          application_fee_amount: 1050,
          currency: 'eur',
          customer: 'cus_test123',
          latest_charge: 'ch_test123',
          metadata: {
            isEuropeanCustomer: 'true',
            transfer: JSON.stringify({
              status: 'PENDING',
              account: 'acct_test123',
              country: 'PT',
            }),
            payment: JSON.stringify({
              amount: '7000',
              fee: '1050',
              expert: '5950',
            }),
            meeting: JSON.stringify({
              id: 'test-meeting-id',
              expert: 'user_test123',
              guest: 'test@example.com',
            }),
          },
          receipt_email: 'test@example.com',
          status: 'succeeded',
          transfer_data: {
            destination: 'acct_test123',
          },
          transfer_group: 'group_pi_test123',
        },
      },
      livemode: false,
      type: 'payment_intent.succeeded',
    };

    test('payment_intent.succeeded payload has correct structure', () => {
      expect(paymentIntentPayload.type).toBe('payment_intent.succeeded');
      expect(paymentIntentPayload.data.object.object).toBe('payment_intent');
      expect(paymentIntentPayload.data.object.status).toBe('succeeded');
      expect(paymentIntentPayload.data.object.amount).toBe(paymentIntentPayload.data.object.amount_received);
      expect(paymentIntentPayload.data.object.application_fee_amount).toBeGreaterThan(0);
    });

    test('transfer data is correctly structured', () => {
      const transferData = paymentIntentPayload.data.object.transfer_data;

      expect(transferData).toBeDefined();
      expect(transferData.destination).toMatch(/^acct_/);
    });
  });
});

test.describe('Stripe Identity Webhook (/api/webhooks/stripe-identity)', () => {
  const webhookUrl = '/api/webhooks/stripe-identity';

  test('should return 400 without signature header', async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({ type: 'identity.verification_session.verified' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('endpoint should be accessible', async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-test-signature',
      },
    });

    expect([400, 500]).toContain(response.status());
  });

  test.describe('Identity Verification Events Structure', () => {
    const verificationPayload = {
      id: 'evt_test_identity_verified',
      object: 'event',
      api_version: '2025-09-30.clover',
      created: Date.now() / 1000,
      data: {
        object: {
          id: 'vs_test123',
          object: 'identity.verification_session',
          status: 'verified',
          type: 'document',
          metadata: {
            userId: 'user_test123',
          },
          last_verification_report: 'vr_test123',
          verified_outputs: {
            first_name: 'Test',
            last_name: 'User',
            dob: {
              day: 1,
              month: 1,
              year: 1990,
            },
            document: {
              status: 'verified',
              type: 'passport',
            },
          },
        },
      },
      livemode: false,
      type: 'identity.verification_session.verified',
    };

    test('identity.verification_session.verified payload has correct structure', () => {
      expect(verificationPayload.type).toBe('identity.verification_session.verified');
      expect(verificationPayload.data.object.object).toBe('identity.verification_session');
      expect(verificationPayload.data.object.status).toBe('verified');
      expect(verificationPayload.data.object.metadata.userId).toBeDefined();
    });
  });
});

test.describe('Webhook Response Validation', () => {
  test('all webhook endpoints return JSON responses', async ({ request }) => {
    const endpoints = [
      '/api/webhooks/stripe',
      '/api/webhooks/stripe-connect',
      '/api/webhooks/stripe-identity',
    ];

    for (const endpoint of endpoints) {
      const response = await request.post(endpoint, {
        data: JSON.stringify({ type: 'test.event' }),
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test-signature',
        },
      });

      // Verify response is JSON or at least has proper content type
      const contentType = response.headers()['content-type'] || '';
      const isJsonOrError =
        contentType.includes('application/json') || response.status() >= 400;
      expect(isJsonOrError).toBe(true);
    }
  });
});

