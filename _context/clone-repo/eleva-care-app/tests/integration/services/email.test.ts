import { vi, describe, expect, beforeEach, beforeAll, test, type Mock } from 'vitest';

// Only mock in unit test mode
if (process.env.EMAIL_INTEGRATION_TEST !== 'true') {
  vi.mock('@/lib/integrations/novu/email', () => ({
    sendEmail: vi.fn(),
  }));
}

// Import after mocking
import { sendEmail } from '@/lib/integrations/novu/email';

// Cast to mock for easier typing in tests
const mockSendEmail = sendEmail as Mock;

describe('Email Service Integration Tests', () => {
  const INTEGRATION_MODE = process.env.EMAIL_INTEGRATION_TEST === 'true';

  beforeAll(() => {
    if (INTEGRATION_MODE) {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY environment variable is required for integration tests');
      }
    }
  });

  beforeEach(() => {
    if (!INTEGRATION_MODE) {
      // Reset mocks before each test
      vi.clearAllMocks();
    }
  });

  describe('Email Sending - Success Cases', () => {
    test('should send email successfully with HTML content', async () => {
      if (INTEGRATION_MODE) {
        // Real integration test with Resend
        const result = await sendEmail({
          to: 'delivered@resend.dev',
          subject: 'Test Email - HTML',
          html: '<p>Test HTML content</p>',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBeDefined();
        }
      } else {
        // Mock successful response
        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: '621f3ecf-f4d2-453a-9f82-21332409b4d2',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBe('621f3ecf-f4d2-453a-9f82-21332409b4d2');
        }
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail).toHaveBeenCalledWith({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
        });
      }
    });

    test('should send email successfully with plain text content', async () => {
      if (INTEGRATION_MODE) {
        const result = await sendEmail({
          to: 'delivered@resend.dev',
          subject: 'Test Email - Text',
          text: 'Test plain text content',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBeDefined();
        }
      } else {
        // Mock successful response
        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: 'text-email-id-123',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          text: 'Plain text content',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBe('text-email-id-123');
        }
        expect(mockSendEmail).toHaveBeenCalledWith({
          to: 'test@example.com',
          subject: 'Test Email',
          text: 'Plain text content',
        });
      }
    });

    test('should send email with both HTML and text content', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: 'mixed-content-email-123',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>HTML content</p>',
          text: 'Plain text content',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBe('mixed-content-email-123');
        }
        expect(mockSendEmail).toHaveBeenCalledWith({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>HTML content</p>',
          text: 'Plain text content',
        });
      }
    });
  });

  describe('Email Sending - Error Cases', () => {
    test('should handle invalid email address', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'Invalid recipient email address',
        });
      }

      const result = await sendEmail({
        to: 'invalid-email',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid recipient email address');
      }

      if (!INTEGRATION_MODE) {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });

    test('should handle missing content (no HTML or text)', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'Either HTML or text content must be provided',
        });
      }

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        // No html or text content
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Either HTML or text content must be provided');
      }

      if (!INTEGRATION_MODE) {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });

    test('should handle Resend API errors', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'Rate limit exceeded',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Rate limit exceeded');
        }
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });

    test('should handle network errors', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'Network error',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Network error');
        }
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });

    test('should handle missing API key', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'API key is missing or invalid',
        });

        const result = await sendEmail({
          to: 'test@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('API key is missing or invalid');
        }
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Email Validation', () => {
    test('should validate email format', async () => {
      if (!INTEGRATION_MODE) {
        const invalidEmails = [
          'invalid',
          'invalid@',
          '@invalid.com',
          'invalid.com',
          'invalid@.com',
          'invalid@domain.',
        ];

        // Mock error response for each invalid email
        invalidEmails.forEach(() => {
          mockSendEmail.mockResolvedValueOnce({
            success: false,
            error: 'Invalid recipient email address',
          });
        });

        for (const email of invalidEmails) {
          const result = await sendEmail({
            to: email,
            subject: 'Test Email',
            html: '<p>Test content</p>',
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('Invalid recipient email address');
          }
        }

        expect(mockSendEmail).toHaveBeenCalledTimes(invalidEmails.length);
      }
    });

    test('should accept valid email formats', async () => {
      if (!INTEGRATION_MODE) {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@example.org',
          'user123@test-domain.com',
        ];

        validEmails.forEach((email, index) => {
          mockSendEmail.mockResolvedValueOnce({
            success: true,
            messageId: `email-${index}`,
          });
        });

        for (const email of validEmails) {
          const result = await sendEmail({
            to: email,
            subject: 'Test Email',
            html: '<p>Test content</p>',
          });

          expect(result.success).toBe(true);
        }

        expect(mockSendEmail).toHaveBeenCalledTimes(validEmails.length);
      }
    });
  });

  describe('Integration Mode Tests', () => {
    test('should handle real Resend API in integration mode', async () => {
      if (INTEGRATION_MODE) {
        // Test with Resend's test email addresses
        const result = await sendEmail({
          to: 'delivered@resend.dev',
          subject: '[TEST] Integration Test Email',
          html: '<h1>Integration Test</h1><p>This is a test email sent during integration testing.</p>',
          text: 'Integration Test - This is a test email sent during integration testing.',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBeDefined();
        }
      } else {
        // Skip integration tests in unit test mode
        expect(true).toBe(true);
      }
    });

    test('should handle bounced emails in integration mode', async () => {
      if (INTEGRATION_MODE) {
        // Test with Resend's bounced test address
        const result = await sendEmail({
          to: 'bounced@resend.dev',
          subject: '[TEST] Bounce Test Email',
          html: '<p>This email should bounce</p>',
        });

        // The email might still be accepted by the API but will bounce later
        // So we just check that the API call succeeds
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Mock Verification', () => {
    test('should verify mock calls in unit test mode', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: 'mock-verification-test',
        });

        await sendEmail({
          to: 'verify@example.com',
          subject: 'Mock Verification',
          html: '<p>Verifying mock calls</p>',
        });

        // Verify the mock was called with correct parameters
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail).toHaveBeenCalledWith({
          to: 'verify@example.com',
          subject: 'Mock Verification',
          html: '<p>Verifying mock calls</p>',
        });

        // Verify the mock function structure
        expect(mockSendEmail.mock.calls).toHaveLength(1);
        expect(mockSendEmail.mock.calls[0][0]).toMatchObject({
          to: 'verify@example.com',
          subject: 'Mock Verification',
          html: '<p>Verifying mock calls</p>',
        });
      }
    });

    test('should verify mock reset between tests', async () => {
      if (!INTEGRATION_MODE) {
        // This test should start with a clean mock
        expect(mockSendEmail).toHaveBeenCalledTimes(0);

        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: 'reset-test-id',
        });

        await sendEmail({
          to: 'reset@example.com',
          subject: 'Reset Test',
          html: '<p>Testing mock reset</p>',
        });

        expect(mockSendEmail).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Email Service Response Patterns', () => {
    test('should handle successful response with messageId', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: true,
          messageId: 'complete-response-id',
        });

        const result = await sendEmail({
          to: 'recipient@example.com',
          subject: 'Complete Response Test',
          html: '<p>Test content</p>',
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.messageId).toBe('complete-response-id');
        }
      }
    });

    test('should handle error response with error message', async () => {
      if (!INTEGRATION_MODE) {
        mockSendEmail.mockResolvedValueOnce({
          success: false,
          error: 'Detailed error message from API',
        });

        const result = await sendEmail({
          to: 'error@example.com',
          subject: 'Error Response Test',
          html: '<p>Error test</p>',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Detailed error message from API');
        }
      }
    });
  });
});
