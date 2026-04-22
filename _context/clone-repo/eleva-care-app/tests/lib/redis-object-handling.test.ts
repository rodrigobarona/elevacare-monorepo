/**
 * Tests for RedisManager object handling
 *
 * Tests the fix for Upstash Redis REST API returning objects instead of strings
 */
import { redisManager } from '@/lib/redis/manager';

describe('RedisManager Object Handling', () => {
  const testKey = 'test:redis-object-handling';

  afterEach(async () => {
    // Clean up test keys
    await redisManager.del(testKey);
  });

  describe('get() method', () => {
    it('should handle string responses correctly', async () => {
      // Store a stringified JSON value
      const testData = { name: 'John Doe', userId: 'user_123' };
      await redisManager.set(testKey, JSON.stringify(testData), 60);

      // Retrieve and verify it's a string
      const result = await redisManager.get(testKey);

      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');

      // Verify we can parse it back
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);
    });

    it('should handle null responses correctly', async () => {
      // Try to get a non-existent key
      const result = await redisManager.get('non-existent-key-' + Date.now());

      expect(result).toBeNull();
    });

    it('should handle empty string values', async () => {
      // Store an empty string
      await redisManager.set(testKey, '', 60);

      // Retrieve and verify
      const result = await redisManager.get(testKey);

      expect(result).toBe('');
      expect(typeof result).toBe('string');
    });

    it('should handle numeric string values', async () => {
      // Store a numeric string
      await redisManager.set(testKey, '12345', 60);

      // Retrieve and verify
      const result = await redisManager.get(testKey);

      expect(result).toBe('12345');
      expect(typeof result).toBe('string');
    });

    it('should handle complex JSON structures', async () => {
      // Store a complex nested object
      const testData = {
        users: [
          { id: 'user_1', name: 'John' },
          { id: 'user_2', name: 'Jane' },
        ],
        metadata: {
          timestamp: Date.now(),
          version: '1.0',
        },
      };

      await redisManager.set(testKey, JSON.stringify(testData), 60);

      // Retrieve and verify
      const result = await redisManager.get(testKey);

      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);
    });

    it('should handle array values', async () => {
      // Store an array
      const testData = ['item1', 'item2', 'item3'];
      await redisManager.set(testKey, JSON.stringify(testData), 60);

      // Retrieve and verify
      const result = await redisManager.get(testKey);

      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('set() and get() integration', () => {
    it('should round-trip data correctly', async () => {
      const testData = {
        eventId: 'evt_123',
        guestEmail: 'test@example.com',
        startTime: new Date().toISOString(),
        status: 'completed' as const,
        timestamp: Date.now(),
      };

      // Store data
      await redisManager.set(testKey, JSON.stringify(testData), 60);

      // Retrieve data
      const result = await redisManager.get(testKey);

      expect(result).not.toBeNull();

      // Parse and verify
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);
    });

    it('should handle TTL expiration', async () => {
      // Store data with 1 second TTL
      await redisManager.set(testKey, 'test-value', 1);

      // Immediately retrieve - should exist
      const result1 = await redisManager.get(testKey);
      expect(result1).toBe('test-value');

      // Wait for expiration (2 seconds to be safe)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Retrieve again - should be null
      const result2 = await redisManager.get(testKey);
      expect(result2).toBeNull();
    }, 10000); // Increase timeout for this test
  });

  describe('Cache consistency', () => {
    it('should maintain data integrity across multiple operations', async () => {
      const keys = ['test:key1', 'test:key2', 'test:key3'];
      const values = [
        { id: 1, data: 'value1' },
        { id: 2, data: 'value2' },
        { id: 3, data: 'value3' },
      ];

      // Store multiple values
      for (let i = 0; i < keys.length; i++) {
        await redisManager.set(keys[i], JSON.stringify(values[i]), 60);
      }

      // Retrieve and verify all values
      for (let i = 0; i < keys.length; i++) {
        const result = await redisManager.get(keys[i]);
        expect(result).not.toBeNull();

        const parsed = JSON.parse(result as string);
        expect(parsed).toEqual(values[i]);
      }

      // Clean up
      for (const key of keys) {
        await redisManager.del(key);
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON gracefully in consumer code', async () => {
      // Store invalid JSON (this shouldn't happen in practice, but test it)
      await redisManager.set(testKey, 'not-valid-json', 60);

      const result = await redisManager.get(testKey);
      expect(result).toBe('not-valid-json');

      // Consumer code should handle parse errors
      expect(() => JSON.parse(result as string)).toThrow();
    });

    it('should handle extremely large cache keys', async () => {
      const largeKey = 'test:' + 'a'.repeat(1000);
      const testData = { value: 'test' };

      await redisManager.set(largeKey, JSON.stringify(testData), 60);
      const result = await redisManager.get(largeKey);

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);

      // Clean up
      await redisManager.del(largeKey);
    });

    it('should handle special characters in cache values', async () => {
      const testData = {
        message: 'Hello "World" with \n newlines and \t tabs',
        unicode: '👋 🌍 こんにちは',
        special: `<script>alert('XSS')</script>`,
      };

      await redisManager.set(testKey, JSON.stringify(testData), 60);
      const result = await redisManager.get(testKey);

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual(testData);
    });
  });
});
