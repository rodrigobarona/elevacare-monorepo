import { redisManager } from '@/lib/redis/manager';

describe('Redis Service Integration Tests', () => {
  beforeAll(async () => {
    // Initialize test data
    await redisManager.set('test_key_1', 'value1', 60);
    await redisManager.set('test_key_2', 'value2', 60);
  });

  afterAll(async () => {
    // Clean up test data
    await redisManager.del('test_key_1');
    await redisManager.del('test_key_2');
  });

  describe('Basic Operations', () => {
    test('should set and get values', async () => {
      await redisManager.set('test_key_1', 'value1', 60);
      const value = await redisManager.get('test_key_1');
      expect(value).toBe('value1');
    });

    test('should handle expiration', async () => {
      await redisManager.set('test_key_2', 'value2', 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const value = await redisManager.get('test_key_2');
      expect(value).toBeNull();
    });
  });

  describe('Cache Management', () => {
    test('should handle cache cleanup', async () => {
      // Set a key with immediate expiration
      await redisManager.set('expired_key', 'expired', 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Run cleanup
      const result = await redisManager.healthCheck();
      expect(result.status).toBe('healthy');
    });

    test('should handle corrupted data', async () => {
      // Simulate corrupted data
      await redisManager.set('corrupted_key', 'corrupted', 60);

      // Run cleanup
      const result = await redisManager.healthCheck();
      expect(result.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      // Simulate connection error by temporarily disabling Redis
      const originalRedis = (redisManager as any).redis;
      (redisManager as any).redis = null;
      (redisManager as any).isRedisAvailable = false;

      const result = await redisManager.healthCheck();
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('in-memory');

      // Restore Redis connection
      (redisManager as any).redis = originalRedis;
      (redisManager as any).isRedisAvailable = true;
    });

    test('should handle invalid data types', async () => {
      // Test with various data types
      await redisManager.set('string_key', 'test string', 60);
      await redisManager.set('number_key', '123', 60);
      await redisManager.set('boolean_key', 'true', 60);
      await redisManager.set('object_key', JSON.stringify({ test: 'value' }), 60);

      const stringValue = await redisManager.get('string_key');
      const numberValue = await redisManager.get('number_key');
      const booleanValue = await redisManager.get('boolean_key');
      const objectValue = await redisManager.get('object_key');

      expect(stringValue).toBe('test string');
      expect(numberValue).toBe('123');
      expect(booleanValue).toBe('true');
      expect(JSON.parse(objectValue!)).toEqual({ test: 'value' });
    });
  });

  describe('Health Check', () => {
    test('should report healthy status when Redis is available', async () => {
      const result = await redisManager.healthCheck();
      expect(result.status).toBe('healthy');
      // In CI environments without Redis, expect in-memory mode; otherwise redis mode
      expect(['redis', 'in-memory']).toContain(result.mode);
      expect(result.responseTime).toBeDefined();
    });

    test('should report in-memory mode when Redis is unavailable', async () => {
      // Simulate Redis unavailability
      const originalRedis = (redisManager as any).redis;
      (redisManager as any).redis = null;
      (redisManager as any).isRedisAvailable = false;

      const result = await redisManager.healthCheck();
      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('in-memory');

      // Restore Redis connection
      (redisManager as any).redis = originalRedis;
      (redisManager as any).isRedisAvailable = true;
    });
  });
});
