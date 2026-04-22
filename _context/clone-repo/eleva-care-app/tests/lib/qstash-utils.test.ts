/**
 * Unit tests for QStash verification utilities
 *
 * Tests the isVerifiedQStashRequest function which validates incoming QStash requests
 * using HMAC-SHA256 signatures.
 *
 * The production code uses the runtime-aware crypto utility from @/lib/utils/crypto,
 * which automatically uses node:crypto in test/Vercel environments and Bun.CryptoHasher
 * locally. This means tests run with the same crypto implementation as production on Vercel.
 *
 * @see {@link src/lib/utils/crypto.ts} for the runtime-aware crypto implementation
 * @see {@link _docs/03-infrastructure/BUN-RUNTIME-MIGRATION.md} for hybrid approach details
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHmacSha256 } from '@/lib/utils/crypto';

// Mock the config module before importing the function under test
vi.mock('@/lib/integrations/qstash/config', () => ({
  validateQStashConfig: vi.fn(),
}));

// Import after mocking
import { isVerifiedQStashRequest } from '@/lib/integrations/qstash/utils';
import { validateQStashConfig } from '@/lib/integrations/qstash/config';

const mockedValidateQStashConfig = vi.mocked(validateQStashConfig);

describe('isVerifiedQStashRequest', () => {
  const TEST_SIGNING_KEY = 'test-signing-key-12345';
  const TEST_API_KEY = 'test-cron-api-key';

  // Store original env and Date.now
  const originalEnv = { ...process.env };
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Store and mock Date.now
    originalDateNow = Date.now;

    // Set up valid environment
    process.env.QSTASH_CURRENT_SIGNING_KEY = TEST_SIGNING_KEY;
    process.env.CRON_API_KEY = TEST_API_KEY;

    // Default to valid config
    mockedValidateQStashConfig.mockReturnValue({
      isValid: true,
      message: 'QStash configuration is valid',
    });
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
    Date.now = originalDateNow;
    vi.restoreAllMocks();
  });

  /**
   * Helper to compute HMAC-SHA256 signature using the runtime-aware crypto utility
   * In tests, this uses node:crypto (same as Vercel production)
   */
  function computeSignature(timestamp: string, key: string): string {
    return createHmacSha256(key, timestamp);
  }

  /**
   * Helper to create a verification token (timestamp.signature format)
   */
  function createVerificationToken(timestamp: number, key: string): string {
    const timestampStr = timestamp.toString();
    const signature = computeSignature(timestampStr, key);
    return `${timestampStr}.${signature}`;
  }

  /**
   * Helper to create Headers with given properties
   */
  function createHeaders(props: Record<string, string>): Headers {
    const headers = new Headers();
    for (const [key, value] of Object.entries(props)) {
      headers.set(key, value);
    }
    return headers;
  }

  describe('API Key Authentication', () => {
    it('should return true when valid API key is provided', async () => {
      const headers = createHeaders({
        'x-api-key': TEST_API_KEY,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });

    it('should not authenticate with invalid API key', async () => {
      const headers = createHeaders({
        'x-api-key': 'wrong-api-key',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });
  });

  describe('UpStash Identifiers', () => {
    it('should accept request with UpStash user agent and signature header', async () => {
      const headers = createHeaders({
        'user-agent': 'Upstash-QStash/1.0',
        'upstash-signature': 'some-signature',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });

    it('should accept request with QStash user agent and request header', async () => {
      const headers = createHeaders({
        'user-agent': 'QStash/1.0',
        'x-qstash-request': 'true',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });
  });

  describe('Valid Signature Verification', () => {
    it('should return true for valid HMAC-SHA256 signature within time window', async () => {
      // Set current time
      const currentTime = 1700000000000; // Fixed timestamp for testing
      Date.now = vi.fn(() => currentTime);

      // Create a valid token with timestamp within the 30-minute window
      const tokenTimestamp = Math.floor(currentTime / 1000) - 60; // 1 minute ago
      const verificationToken = createVerificationToken(tokenTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });

    it('should return true for signature at exactly the time boundary', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from exactly 30 minutes ago (1800 seconds)
      const tokenTimestamp = Math.floor(currentTime / 1000) - 1800;
      const verificationToken = createVerificationToken(tokenTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });
  });

  describe('Invalid Signature Verification', () => {
    it('should return false when signature has one byte mutated', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;
      const validSignature = computeSignature(tokenTimestamp.toString(), TEST_SIGNING_KEY);

      // Mutate one character of the signature
      const mutatedSignature =
        validSignature.charAt(0) === 'a'
          ? 'b' + validSignature.slice(1)
          : 'a' + validSignature.slice(1);

      const invalidToken = `${tokenTimestamp}.${mutatedSignature}`;

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': invalidToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when signature is computed with wrong key', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;
      // Compute signature with a different key
      const wrongKeySignature = computeSignature(tokenTimestamp.toString(), 'wrong-key');
      const invalidToken = `${tokenTimestamp}.${wrongKeySignature}`;

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': invalidToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });
  });

  describe('Expired Token Verification', () => {
    it('should return false when token timestamp is more than 30 minutes old', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from 31 minutes ago (1860 seconds) - just past the 1800 second limit
      const expiredTimestamp = Math.floor(currentTime / 1000) - 1860;
      const verificationToken = createVerificationToken(expiredTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when token timestamp is significantly expired', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from 1 hour ago
      const veryExpiredTimestamp = Math.floor(currentTime / 1000) - 3600;
      const verificationToken = createVerificationToken(veryExpiredTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when token timestamp is in the future (beyond tolerance)', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from 1 hour in the future (beyond the 60-second clock skew tolerance)
      // Should be rejected to prevent replay attacks with pre-generated future tokens
      const futureTimestamp = Math.floor(currentTime / 1000) + 3600;
      const verificationToken = createVerificationToken(futureTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should accept token with timestamp slightly in the future (within clock skew tolerance)', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from 30 seconds in the future (within the 60-second clock skew tolerance)
      const futureTimestamp = Math.floor(currentTime / 1000) + 30;
      const verificationToken = createVerificationToken(futureTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });

    it('should return false when token timestamp exceeds clock skew tolerance', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      // Token from 90 seconds in the future (exceeds 60-second tolerance)
      const futureTimestamp = Math.floor(currentTime / 1000) + 90;
      const verificationToken = createVerificationToken(futureTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases - Malformed Input', () => {
    it('should return false for empty verification token', async () => {
      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': '',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false for token without separator', async () => {
      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': 'notokenformat',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false for token with only timestamp (no signature)', async () => {
      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': '1700000000.',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false for token with only signature (no timestamp)', async () => {
      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': '.abcdef123456',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false for token with non-numeric timestamp', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': 'not-a-number.abcdef123456',
      });

      const result = await isVerifiedQStashRequest(headers);
      // parseInt('not-a-number') returns NaN.
      // The implementation explicitly checks Number.isNaN(tokenTime) and returns
      // false immediately with a warning, before any time comparison or signature verification.
      expect(result).toBe(false);
    });

    it('should return false for explicitly NaN timestamp', async () => {
      // parseInt('NaN') returns NaN.
      // The implementation explicitly checks Number.isNaN(tokenTime) in utils.ts
      // and returns false immediately with a "invalid timestamp" warning.
      // No time comparison or signature verification occurs for NaN timestamps.
      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': 'NaN.abcdef123456',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false for token with invalid hex signature', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': `${tokenTimestamp}.not-valid-hex-zzz`,
      });

      // timingSafeEqual will throw when Buffer.from fails on invalid hex
      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases - Missing Configuration', () => {
    it('should return false when QSTASH_CURRENT_SIGNING_KEY is missing', async () => {
      delete process.env.QSTASH_CURRENT_SIGNING_KEY;

      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;
      const verificationToken = createVerificationToken(tokenTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when QStash config is invalid and no UpStash identifiers', async () => {
      mockedValidateQStashConfig.mockReturnValue({
        isValid: false,
        message: 'Missing QSTASH_TOKEN',
      });

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': 'some.token',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should accept when config is invalid but has UpStash user-agent', async () => {
      mockedValidateQStashConfig.mockReturnValue({
        isValid: false,
        message: 'Missing QSTASH_TOKEN',
      });

      const headers = createHeaders({
        'user-agent': 'Upstash-QStash/1.0',
        'x-qstash-request': 'true',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases - Missing Headers', () => {
    it('should return false for completely empty headers', async () => {
      const headers = new Headers();

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when x-qstash-request header is missing', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;
      const verificationToken = createVerificationToken(tokenTimestamp, TEST_SIGNING_KEY);

      const headers = createHeaders({
        // Missing 'x-qstash-request': 'true'
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });

    it('should return false when x-qstash-request is not "true"', async () => {
      const headers = createHeaders({
        'x-qstash-request': 'false',
        'x-internal-qstash-verification': 'some.token',
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(false);
    });
  });

  describe('Signature Algorithm Verification', () => {
    it('should use HMAC-SHA256 with hex encoding', async () => {
      const currentTime = 1700000000000;
      Date.now = vi.fn(() => currentTime);

      const tokenTimestamp = Math.floor(currentTime / 1000) - 60;
      const timestampStr = tokenTimestamp.toString();

      // Compute expected signature using the runtime-aware crypto utility
      const expectedSignature = createHmacSha256(TEST_SIGNING_KEY, timestampStr);

      // Verify signature is 64 hex characters (256 bits = 32 bytes = 64 hex chars)
      expect(expectedSignature).toHaveLength(64);
      expect(expectedSignature).toMatch(/^[0-9a-f]+$/);

      const verificationToken = `${tokenTimestamp}.${expectedSignature}`;

      const headers = createHeaders({
        'x-qstash-request': 'true',
        'x-internal-qstash-verification': verificationToken,
      });

      const result = await isVerifiedQStashRequest(headers);
      expect(result).toBe(true);
    });
  });
});

