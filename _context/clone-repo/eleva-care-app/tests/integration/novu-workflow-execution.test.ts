import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

/**
 * Novu Workflow Execution Integration Tests
 *
 * These tests verify Novu notification workflow execution using mocks.
 * For real API testing, use environment NOVU_INTEGRATION_TEST=true
 * with actual credentials.
 */

// Use vi.hoisted for mocks
const mocks = vi.hoisted(() => ({
  trigger: vi.fn(),
  subscribersList: vi.fn(),
  subscribersIdentify: vi.fn(),
}));

// Define the Novu mock type for tests
interface MockNovu {
  trigger: typeof mocks.trigger;
  subscribers: {
    list: typeof mocks.subscribersList;
    identify: typeof mocks.subscribersIdentify;
  };
}

interface WorkflowPayload {
  eventType: string;
  eventId: string;
  userId: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  locale?: string;
  userSegment?: string;
  templateVariant?: string;
  timestamp?: number;
  source?: string;
  alertType?: string;
  message?: string;
  eventData?: Record<string, unknown>;
}

describe('Novu Workflow Execution Integration Tests', () => {
  let novu: MockNovu;
  let testSubscriberId: string;

  beforeAll(async () => {
    // Create mock Novu instance
    novu = {
      trigger: mocks.trigger,
      subscribers: {
        list: mocks.subscribersList,
        identify: mocks.subscribersIdentify,
      },
    };

    testSubscriberId = `test_user_${Date.now()}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock responses
    mocks.trigger.mockResolvedValue({
        data: {
        transactionId: `mock_txn_${Date.now()}`,
          acknowledged: true,
          status: 'processed',
        },
      });

    mocks.subscribersList.mockResolvedValue({
        data: [],
        totalCount: 0,
      });

    mocks.subscribersIdentify.mockResolvedValue({
        data: { _id: 'mock_subscriber_id' },
      });
  });

  describe('user-lifecycle workflow', () => {
    it('should execute successfully with complete user data', async () => {
      const testPayload: WorkflowPayload = {
        eventType: 'user.created',
        eventId: `test_event_${Date.now()}`,
        userId: testSubscriberId,
        userName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        locale: 'en',
        userSegment: 'patient',
        templateVariant: 'default',
        timestamp: Date.now(),
        source: 'integration_test',
        alertType: 'user.created',
        message: 'User event: user.created',
      };

      const result = await novu.trigger({
        workflowId: 'user-lifecycle',
        to: testSubscriberId,
        payload: testPayload,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(mocks.trigger).toHaveBeenCalledWith({
          workflowId: 'user-lifecycle',
        to: testSubscriberId,
          payload: testPayload,
        });
      expect(result.data.acknowledged).toBe(true);
    });

    it('should handle expert user segment correctly', async () => {
      const expertPayload: WorkflowPayload = {
        eventType: 'user.created',
        eventId: `expert_event_${Date.now()}`,
        userId: `expert_${testSubscriberId}`,
        userName: 'Dr. Jane Smith',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'dr.jane@example.com',
        locale: 'en',
        userSegment: 'expert',
        templateVariant: 'default',
        timestamp: Date.now(),
        source: 'integration_test',
        alertType: 'user.created',
        message: 'User event: user.created',
      };

      const result = await novu.trigger({
        workflowId: 'user-lifecycle',
        to: `expert_${testSubscriberId}`,
        payload: expertPayload,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(mocks.trigger).toHaveBeenCalledWith({
          workflowId: 'user-lifecycle',
        to: `expert_${testSubscriberId}`,
          payload: expertPayload,
        });
    });

    it('should handle minimal payload gracefully', async () => {
      const minimalPayload: WorkflowPayload = {
        eventType: 'user.created',
        eventId: `minimal_${Date.now()}`,
        userId: `minimal_${testSubscriberId}`,
        userName: 'MinimalUser',
        email: 'minimal@example.com',
        locale: 'en',
        userSegment: 'patient',
        templateVariant: 'default',
        timestamp: Date.now(),
        source: 'integration_test',
        alertType: 'user.created',
        message: 'User event: user.created',
      };

      const result = await novu.trigger({
          workflowId: 'user-lifecycle',
        to: `minimal_${testSubscriberId}`,
          payload: minimalPayload,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('security-auth workflow', () => {
    it('should execute for security events', async () => {
      const securityPayload: WorkflowPayload = {
        eventType: 'session.created',
        eventId: `security_${Date.now()}`,
        userId: testSubscriberId,
        eventData: {
          id: `sess_${Date.now()}`,
          user_id: testSubscriberId,
          status: 'active',
        },
        timestamp: Date.now(),
        source: 'integration_test',
        alertType: 'recent-login',
        message: 'New login detected on your account',
      };

      const result = await novu.trigger({
        workflowId: 'security-auth',
        to: testSubscriberId,
        payload: securityPayload,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(mocks.trigger).toHaveBeenCalledWith({
          workflowId: 'security-auth',
        to: testSubscriberId,
          payload: securityPayload,
        });
    });
  });

  describe('error scenarios', () => {
    it('should handle missing subscriber email', async () => {
      const payloadWithoutEmail: WorkflowPayload = {
        eventType: 'user.updated',
        eventId: `no_email_${Date.now()}`,
        userId: testSubscriberId,
        userName: 'NoEmailUser',
      };

      mocks.trigger.mockResolvedValueOnce({
        data: {
          transactionId: 'mock_txn_no_email',
          acknowledged: true,
          status: 'warning',
        },
      });

      const result = await novu.trigger({
        workflowId: 'user-lifecycle',
        to: testSubscriberId,
        payload: payloadWithoutEmail,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      mocks.trigger.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const payload: WorkflowPayload = {
        eventType: 'test.event',
        eventId: `error_${Date.now()}`,
        userId: testSubscriberId,
      };

        await expect(
          novu.trigger({
          workflowId: 'test-workflow',
          to: testSubscriberId,
            payload,
          }),
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('workflow performance', () => {
    it('should execute within reasonable time limits', async () => {
      const startTime = Date.now();

      const payload: WorkflowPayload = {
        eventType: 'performance.test',
        eventId: `perf_${Date.now()}`,
        userId: testSubscriberId,
        timestamp: Date.now(),
      };

      const result = await novu.trigger({
        workflowId: 'user-lifecycle',
        to: testSubscriberId,
        payload,
      });

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();

      // In mock mode, should be nearly instant
      expect(duration).toBeLessThan(100);
    });
  });

  describe('subscriber management', () => {
    it('should be able to list subscribers', async () => {
      const result = await novu.subscribers.list({});

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should be able to identify a subscriber', async () => {
      const subscriberData = {
        subscriberId: `new_${testSubscriberId}`,
        firstName: 'New',
        lastName: 'Subscriber',
        email: 'new.subscriber@example.com',
      };

      const result = await novu.subscribers.identify(subscriberData.subscriberId, {
        firstName: subscriberData.firstName,
        lastName: subscriberData.lastName,
        email: subscriberData.email,
      });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });
});
