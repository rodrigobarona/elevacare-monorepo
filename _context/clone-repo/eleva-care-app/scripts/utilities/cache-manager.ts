#!/usr/bin/env tsx
/**
 * Unified Cache Management Script
 *
 * This script provides cache management utilities for:
 * - Clerk user cache
 * - Rate limit cache
 * - Payment cache
 * - General Redis cache operations
 *
 * Usage:
 *   bun scripts/utilities/cache-manager.ts <command> [options]
 *
 * Commands:
 *   clear-clerk [--env=dev|prod|test]  - Clear Clerk cache for specific environment
 *   clear-all                          - Clear all cache entries
 *   health                             - Check Redis health status
 *   stats                              - Show cache statistics
 *
 * Examples:
 *   bun scripts/utilities/cache-manager.ts clear-clerk --env=development
 *   bun scripts/utilities/cache-manager.ts clear-all
 *   bun scripts/utilities/cache-manager.ts health
 */
import { redisManager } from '@/lib/redis/manager';

const args = process.argv.slice(2);
const command = args[0];
const envArg = args.find((arg) => arg.startsWith('--env='))?.split('=')[1];

interface CacheStats {
  totalKeys: number;
  clerkKeys: number;
  rateLimitKeys: number;
  paymentKeys: number;
  otherKeys: number;
}

async function checkRedisHealth() {
  console.log('🏥 Checking Redis health...\n');

  const healthCheck = await redisManager.healthCheck();

  if (healthCheck.status === 'healthy') {
    console.log(`✅ Redis is healthy`);
    console.log(`   Mode: ${healthCheck.mode}`);
    console.log(`   Response time: ${healthCheck.responseTime}ms`);
  } else {
    console.log(`❌ Redis is unhealthy: ${healthCheck.message}`);
    if (healthCheck.error) {
      console.error('   Error:', healthCheck.error);
    }
  }

  return healthCheck.status === 'healthy';
}

async function getCacheStats(): Promise<CacheStats> {
  console.log('📊 Gathering cache statistics...\n');

  const stats: CacheStats = {
    totalKeys: 0,
    clerkKeys: 0,
    rateLimitKeys: 0,
    paymentKeys: 0,
    otherKeys: 0,
  };

  try {
    // Note: This is a placeholder. Actual implementation would depend on
    // Redis REST API capabilities. Upstash doesn't support KEYS command efficiently.
    console.log('ℹ️  Cache statistics:');
    console.log('   - Clerk cache: expires in 5 minutes');
    console.log('   - Rate limit cache: varies by limit');
    console.log('   - Payment cache: varies by payment');
    console.log('\n💡 Use Upstash dashboard for detailed statistics');

    return stats;
  } catch (error) {
    console.error('❌ Error gathering stats:', error);
    return stats;
  }
}

async function clearClerkCache(environment?: string) {
  const env = environment || process.env.NODE_ENV || 'development';
  console.log(`🧹 Clearing Clerk cache for environment: ${env}\n`);

  try {
    const isHealthy = await checkRedisHealth();

    if (!isHealthy) {
      console.log('\n💡 Falling back to in-memory cache. No action needed.');
      return;
    }

    console.log('\n⚠️  Important: Upstash Redis REST API limitations');
    console.log('   Cannot automatically scan and delete keys via KEYS command.');
    console.log('\n💡 Options:');
    console.log('   1. Wait for cache to expire naturally (5 minutes TTL)');
    console.log('   2. Manually clear via Upstash dashboard');
    console.log('   3. Restart application to force fresh fetches');
    console.log('\n✅ Cache keys are environment-specific:');
    console.log(`   Current env:  clerk:${env}:*`);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    throw error;
  }
}

async function clearAllCache() {
  console.log('🧹 Clearing all cache entries...\n');

  try {
    const isHealthy = await checkRedisHealth();

    if (!isHealthy) {
      console.log('\n💡 Falling back to in-memory cache. No action needed.');
      return;
    }

    console.log('\n⚠️  Use Upstash dashboard to clear all cache entries');
    console.log('   Dashboard: https://console.upstash.com/');
    console.log('\n💡 Alternative: Wait for cache to expire naturally (TTLs vary)');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function showHelp() {
  console.log(`
📚 Cache Manager - Help

Usage:
  bun scripts/utilities/cache-manager.ts <command> [options]

Commands:
  clear-clerk [--env=dev|prod|test]  Clear Clerk cache for specific environment
  clear-all                          Clear all cache entries
  health                             Check Redis health status
  stats                              Show cache statistics
  help                               Show this help message

Examples:
  bun scripts/utilities/cache-manager.ts clear-clerk --env=development
  bun scripts/utilities/cache-manager.ts health
  bun scripts/utilities/cache-manager.ts stats

Options:
  --env=<environment>  Specify environment (development, production, test)

Notes:
  - Cache operations respect Redis availability
  - Falls back to in-memory cache if Redis is unavailable
  - Some operations may require manual intervention via Upstash dashboard
`);
}

async function main() {
  console.log('🚀 Cache Manager\n');

  if (!command || command === 'help') {
    await showHelp();
    return;
  }

  switch (command) {
    case 'clear-clerk':
      await clearClerkCache(envArg);
      break;

    case 'clear-all':
      await clearAllCache();
      break;

    case 'health':
      await checkRedisHealth();
      break;

    case 'stats':
      await getCacheStats();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run with "help" to see available commands');
      process.exit(1);
  }

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
