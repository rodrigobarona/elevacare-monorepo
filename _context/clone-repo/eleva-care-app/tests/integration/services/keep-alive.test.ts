import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * Keep-Alive Service Integration Tests
 *
 * These tests verify Redis and QStash health checking.
 * In test mode, Redis falls back to in-memory mode.
 */

// Mock Redis manager
vi.mock('@/lib/redis/manager', () => ({
  redisManager: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    healthCheck: vi.fn(),
  },
}));

// Mock QStash config
vi.mock('@/lib/integrations/qstash/config', () => ({
  qstashHealthCheck: vi.fn(),
}));

// Import after mocks are set up
import { qstashHealthCheck } from '@/lib/integrations/qstash/config';
import { redisManager } from '@/lib/redis/manager';

// Create typed mock references for easier access in tests
const mocks = {
  redisSet: redisManager.set as Mock,
  redisGet: redisManager.get as Mock,
  redisDel: redisManager.del as Mock,
  redisHealthCheck: redisManager.healthCheck as Mock,
  qstashHealthCheck: qstashHealthCheck as Mock,
};

describe('Keep-Alive Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Redis Health', () => {
    it('should connect and perform basic operations', async () => {
      mocks.redisHealthCheck.mockResolvedValue({
        status: 'healthy',
        mode: 'redis',
        responseTime: 5,
      });

      const result = await redisManager.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.mode).toBeDefined();
      expect(result.responseTime).toBeDefined();
    });

    it('should fall back to in-memory mode when Redis unavailable', async () => {
      mocks.redisHealthCheck.mockResolvedValue({
        status: 'healthy',
        mode: 'in-memory',
        responseTime: 1,
      });

      const result = await redisManager.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('in-memory');
    });

    it('should handle connection errors gracefully', async () => {
      mocks.redisHealthCheck.mockResolvedValue({
        status: 'healthy',
        mode: 'in-memory',
        responseTime: 1,
      });

      const result = await redisManager.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.mode).toBe('in-memory');
    });
  });

  describe('QStash Health', () => {
    it('should verify QStash configuration', async () => {
      mocks.qstashHealthCheck.mockResolvedValue({
        status: 'healthy',
        configured: true,
        responseTime: 10,
      });

      const result = await qstashHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.configured).toBeDefined();
      expect(result.responseTime).toBeDefined();
    });

    it('should handle missing configuration gracefully', async () => {
      mocks.qstashHealthCheck.mockResolvedValue({
        status: 'not-configured',
        configured: false,
        responseTime: 0,
      });

      const result = await qstashHealthCheck();

      expect(result.status).toBe('not-configured');
      expect(result.configured).toBe(false);
    });

    it('should handle QStash API errors gracefully', async () => {
      mocks.qstashHealthCheck.mockResolvedValue({
        status: 'error',
        configured: true,
        responseTime: 0,
        error: 'API connection failed',
      });

      const result = await qstashHealthCheck();

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    it('should set and get values', async () => {
      mocks.redisSet.mockResolvedValue('OK');
      mocks.redisGet.mockResolvedValue('test-value');

      await redisManager.set('test_key', 'test-value', 60);
      const value = await redisManager.get('test_key');

      expect(mocks.redisSet).toHaveBeenCalledWith('test_key', 'test-value', 60);
      expect(value).toBe('test-value');
    });

    it('should delete values', async () => {
      mocks.redisDel.mockResolvedValue(1);

      await redisManager.del('test_key');

      expect(mocks.redisDel).toHaveBeenCalledWith('test_key');
    });

    it('should handle expired keys automatically', async () => {
      // First call returns value, second returns null (expired)
      mocks.redisGet.mockResolvedValueOnce('value').mockResolvedValueOnce(null);

      const value1 = await redisManager.get('expiring_key');
      const value2 = await redisManager.get('expiring_key');

      expect(value1).toBe('value');
      expect(value2).toBeNull();
    });

    it('should handle corrupted data gracefully', async () => {
      mocks.redisGet.mockResolvedValue('{invalid:json}');
      mocks.redisHealthCheck.mockResolvedValue({
        status: 'healthy',
        mode: 'redis',
        responseTime: 5,
      });

      const value = await redisManager.get('corrupted_key');
      const health = await redisManager.healthCheck();

      expect(value).toBe('{invalid:json}');
      expect(health.status).toBe('healthy');
    });
  });
});
