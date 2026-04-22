# Keep-Alive Service Enhancements

## Overview

The keep-alive cron job (`/api/cron/keep-alive`) has been enhanced to include health checks for **Upstash Redis** and **QStash** services, ensuring comprehensive system health monitoring.

## New Features

### 🔴 Redis Health Check

- **PING Command**: Uses Redis `PING` command to test connectivity
- **Fallback Support**: Gracefully handles in-memory cache fallback scenarios
- **Response Time Tracking**: Measures and reports connection latency
- **Error Handling**: Provides detailed error messages for debugging

### 📬 QStash Health Check

- **Configuration Validation**: Verifies all required environment variables
- **Connectivity Test**: Tests actual API connectivity using lightweight operations
- **Response Time Tracking**: Measures and reports API response times
- **Graceful Degradation**: Handles missing configuration scenarios

## Implementation Details

### Redis Health Check

**Location**: `lib/redis.ts` - `RedisManager.healthCheck()`

**Returns**:

```typescript
{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  mode: 'redis' | 'in-memory';
  message: string;
  error?: string;
}
```

**Behavior**:

- If Redis is not configured: Returns `healthy` with `in-memory` mode
- If Redis is configured: Sends `PING` command and expects `PONG` response
- Measures response time for performance monitoring
- Provides detailed error messages for troubleshooting

### QStash Health Check

**Location**: `lib/qstash-config.ts` - `qstashHealthCheck()`

**Returns**:

```typescript
{
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  configured: boolean;
  message: string;
  error?: string;
}
```

**Behavior**:

- Validates configuration using existing `validateQStashConfig()`
- Tests connectivity by listing schedules (lightweight operation)
- Measures response time for performance monitoring
- Indicates whether QStash is properly configured

## Integration with Keep-Alive

The enhanced keep-alive job now performs these checks:

1. **System Health Check** (existing)
2. **Database Connectivity** (existing)
3. **Redis Health Check** ✨ NEW
4. **QStash Health Check** ✨ NEW
5. **Google Calendar Token Refresh** (existing)

### Enhanced Metrics

The `KeepAliveMetrics` interface now includes:

```typescript
interface KeepAliveMetrics {
  // ... existing fields
  redisHealth?: RedisHealthResult;
  qstashHealth?: QStashHealthResult;
}
```

### System Health Calculation

The overall system health now considers:

- Health endpoint status
- Redis connectivity (healthy or in-memory fallback)
- QStash connectivity (healthy or not configured)
- Token refresh success rate

## Environment Variables

### Redis

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### QStash

```bash
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key
```

## Testing

### Manual Testing

Use the provided test script:

```bash
npx tsx scripts/test-keep-alive-services.ts
```

### Expected Output

```
🚀 Starting Keep-Alive Services Health Check Test

🧪 Testing Redis Health Check...
✅ Redis Health Result: {
  status: 'healthy',
  mode: 'redis',
  responseTime: '45ms',
  message: 'Redis PING successful (45ms)',
  error: 'none'
}

🧪 Testing QStash Health Check...
✅ QStash Health Result: {
  status: 'healthy',
  configured: true,
  responseTime: '120ms',
  message: 'QStash connectivity test successful (120ms)',
  error: 'none'
}

📊 Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Redis:  healthy (redis)
QStash: healthy (configured: true)
Overall: 🟢 HEALTHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Monitoring & Logging

### Console Output

The keep-alive job now includes detailed logging:

```
📦 Checking Redis connectivity...
✅ Redis health check: healthy (redis, 45ms)

📬 Checking QStash connectivity...
✅ QStash health check: healthy (configured: true, 120ms)
```

### Metrics in Response

The job response includes service health in the summary:

```json
{
  "serviceHealth": {
    "redis": "healthy (redis, 45ms)",
    "qstash": "healthy (configured: true, 120ms)"
  }
}
```

## Error Scenarios

### Redis Errors

- **Connection timeout**: Status `unhealthy`, detailed timeout message
- **Authentication failure**: Status `unhealthy`, auth error details
- **Network issues**: Status `unhealthy`, network error information
- **Not configured**: Status `healthy`, mode `in-memory`

### QStash Errors

- **Missing token**: Status `unhealthy`, configuration error
- **Invalid credentials**: Status `unhealthy`, authentication error
- **API unavailable**: Status `unhealthy`, connectivity error
- **Not configured**: Status `unhealthy`, missing environment variables

## Performance Considerations

- **Timeout Handling**: Both checks have reasonable timeouts to prevent hanging
- **Lightweight Operations**: QStash uses `schedules.list()` for minimal resource usage
- **Parallel Execution**: Health checks run independently and don't block each other
- **Graceful Fallbacks**: Redis falls back to in-memory mode, QStash reports configuration status

## Benefits

1. **Proactive Monitoring**: Early detection of service issues
2. **Detailed Diagnostics**: Rich error information for troubleshooting
3. **Performance Tracking**: Response time monitoring for all services
4. **Unified Health Status**: Single endpoint for comprehensive system health
5. **Graceful Degradation**: System continues functioning with fallback modes
