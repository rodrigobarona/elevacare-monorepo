# 📊 Monitoring Guide: Novu Integration & System Health

## 🎯 **Overview**

This guide covers monitoring for the recently fixed Novu integration endpoints and provides comprehensive system health monitoring strategies.

## 🔧 **Recently Fixed Endpoints**

### ✅ **Fixed Issues**

1. **`/api/cron/check-upcoming-payouts`** - 401 authentication errors resolved
2. **`/api/healthcheck`** - Direct workflow trigger issues fixed
3. **Notification system** - Proper `triggerWorkflow()` implementation

---

## 📈 **Production Monitoring Setup**

### **1. Health Check Monitoring**

#### **Uptime Monitoring**

```bash
# External health check monitors
curl -f https://eleva.care/api/healthcheck || exit 1

# Expected response structure:
{
  "status": "healthy",
  "timestamp": "2024-01-14T10:00:00.000Z",
  "uptime": 3600,
  "version": "0.3.1",
  "environment": "production",
  "config": {
    "hasDatabase": true,
    "hasAuth": true,
    "hasStripe": true,
    "hasRedis": true,
    "hasQStash": true,
    "hasEmail": true,
    "hasNovu": true
  }
}
```

#### **QStash Health Checks**

```typescript
// Automated health checks via QStash
// Schedule: Every 5 minutes
POST https://eleva.care/api/healthcheck
Headers: {
  "x-qstash-request": "true"
}
```

### **2. Cron Job Monitoring**

#### **Payout Processing Monitor**

```bash
# Monitor payout webhook execution
curl -X GET https://eleva.care/api/cron/check-upcoming-payouts \
  -H "x-qstash-request: true"

# Success response indicators:
{
  "success": true,
  "processed": 5,
  "notificationsSent": 5,
  "notificationsFailed": 0,
  "executionTime": 1250
}
```

#### **Key Metrics to Track**

- **Success Rate**: `success: true` responses
- **Processing Volume**: `processed` count
- **Notification Success**: `notificationsSent` vs `notificationsFailed`
- **Performance**: `executionTime` < 30 seconds
- **Error Rate**: 401/500 response codes

### **3. Novu Integration Monitoring**

#### **Workflow Trigger Success**

```typescript
// Monitor notification success in logs
{
  "level": "info",
  "message": "✅ Notification triggered",
  "workflowId": "user-lifecycle",
  "userId": "expert_123",
  "timestamp": "2024-01-14T10:00:00.000Z"
}
```

#### **Workflow Trigger Failures**

```typescript
// Monitor notification failures
{
  "level": "error",
  "message": "❌ Notification failed",
  "workflowId": "user-lifecycle",
  "userId": "expert_123",
  "error": "401 Unauthorized",
  "timestamp": "2024-01-14T10:00:00.000Z"
}
```

---

## 🚨 **Alerting & Notifications**

### **1. Critical Alerts**

#### **Health Check Failures**

```yaml
# Alert when health check fails
- name: 'Health Check Down'
  condition: "status_code != 200 OR response.status != 'healthy'"
  severity: 'critical'
  notification_channels: ['slack', 'email', 'novu']
  actions:
    - 'Trigger system-health workflow in Novu'
    - 'Page on-call engineer'
```

#### **Authentication Errors**

```yaml
# Alert on 401 errors (previous issue)
- name: 'Authentication Failures'
  condition: 'status_code == 401'
  severity: 'high'
  notification_channels: ['slack']
  context: 'Previous Novu workflow.trigger() issue'
```

#### **Payout Processing Failures**

```yaml
# Monitor payout cron job
- name: 'Payout Processing Failed'
  condition: 'response.success == false OR status_code >= 500'
  severity: 'high'
  notification_channels: ['slack', 'email']
  runbook: 'Check database connectivity and Novu API status'
```

### **2. Performance Alerts**

#### **Slow Response Times**

```yaml
# Monitor endpoint performance
- name: 'Slow Health Check'
  condition: 'response_time > 5000ms'
  severity: 'medium'
  notification_channels: ['slack']

- name: 'Slow Payout Processing'
  condition: 'response.executionTime > 30000'
  severity: 'medium'
  notification_channels: ['slack']
```

#### **High Error Rates**

```yaml
# Monitor error trends
- name: 'High Error Rate'
  condition: 'error_rate > 5% over 10 minutes'
  severity: 'medium'
  notification_channels: ['slack']
```

---

## 📊 **Monitoring Dashboards**

### **1. System Health Dashboard**

#### **Key Metrics**

- Health check success rate (target: 99.9%)
- Response time trends
- Error rate by endpoint
- Uptime percentage

#### **Widgets**

```yaml
# Health Check Status
- type: 'status_indicator'
  endpoint: '/api/healthcheck'
  success_condition: "status == 'healthy'"

# Response Time Graph
- type: 'time_series'
  metric: 'response_time'
  endpoint: '/api/healthcheck'
  timeframe: '24h'

# Error Rate Chart
- type: 'gauge'
  metric: 'error_rate'
  endpoints: ['/api/cron/*', '/api/healthcheck']
  threshold: 5
```

### **2. Novu Integration Dashboard**

#### **Notification Metrics**

- Workflow trigger success rate
- Notification delivery rate
- Failed notification count by workflow
- Response time for notification calls

#### **Widgets**

```yaml
# Notification Success Rate
- type: 'gauge'
  metric: 'notification_success_rate'
  workflows: ['user-lifecycle', 'system-health']
  target: 95

# Failed Notifications by Workflow
- type: 'bar_chart'
  metric: 'failed_notifications'
  group_by: 'workflowId'
  timeframe: '24h'

# Notification Volume
- type: 'time_series'
  metric: 'notifications_sent'
  group_by: 'workflowId'
  timeframe: '7d'
```

### **3. Cron Job Dashboard**

#### **Job Performance**

- Execution success rate by job
- Processing volume trends
- Execution time distribution
- Queue depth and backlog

#### **Widgets**

```yaml
# Cron Job Success Rate
- type: 'heatmap'
  metric: 'cron_success_rate'
  jobs: ['check-upcoming-payouts', 'process-pending-payouts']
  timeframe: '7d'

# Processing Volume
- type: 'stacked_area'
  metrics: ['processed', 'notificationsSent', 'notificationsFailed']
  job: 'check-upcoming-payouts'
  timeframe: '24h'
```

---

## 🔍 **Log Monitoring**

### **1. Key Log Patterns**

#### **Success Patterns**

```bash
# Health check success
"✅ Health check completed successfully"

# Payout processing success
"✅ Processed.*upcoming payouts.*notificationsSent: [0-9]+"

# Notification success
"✅ Notification triggered.*workflowId.*userId"
```

#### **Error Patterns**

```bash
# Previous 401 authentication errors (should be fixed)
"❌.*401.*Unauthorized.*workflow\.trigger"

# Generic notification failures
"❌ Failed to.*notification.*error:"

# Health check failures
"❌ Health check failed.*error:"

# Database connectivity issues
"❌.*Database.*connection.*failed"
```

### **2. Structured Logging**

#### **Success Events**

```json
{
  "level": "info",
  "event": "notification_triggered",
  "workflowId": "user-lifecycle",
  "userId": "expert_123",
  "success": true,
  "executionTime": 250,
  "timestamp": "2024-01-14T10:00:00.000Z"
}
```

#### **Error Events**

```json
{
  "level": "error",
  "event": "notification_failed",
  "workflowId": "system-health",
  "userId": "admin_456",
  "error": "Network timeout",
  "retryAttempt": 1,
  "timestamp": "2024-01-14T10:00:00.000Z"
}
```

---

## 🎯 **Performance Baselines**

### **Expected Response Times**

- Health check: < 2 seconds
- Payout processing: < 30 seconds
- Notification triggering: < 1 second

### **Success Rate Targets**

- Health check availability: 99.9%
- Payout processing success: 99%
- Notification delivery: 95%

### **Volume Expectations**

- Health checks: ~288/day (every 5 minutes)
- Payout notifications: 10-50/day
- System notifications: 1-10/day

---

## 🚀 **Incident Response**

### **1. Health Check Down**

```bash
# Investigation steps
1. Check application logs for errors
2. Verify database connectivity
3. Check external service status (Redis, Novu, Stripe)
4. Review recent deployments
5. Check infrastructure status
```

### **2. Payout Processing Failures**

```bash
# Investigation steps
1. Check QStash delivery status
2. Verify database queries and data integrity
3. Check Novu API status and authentication
4. Review payout eligibility criteria
5. Check for data corruption in payment transfers
```

### **3. Notification Failures**

```bash
# Investigation steps
1. Verify Novu API key and authentication
2. Check workflow definitions in Novu dashboard
3. Validate payload structure and schema
4. Check user subscription status in Novu
5. Review network connectivity to Novu API
```

---

## 📝 **Monitoring Implementation**

### **1. Application-Level Monitoring**

```typescript
// Add to your cron jobs and critical endpoints
import { metrics } from '@/lib/monitoring';

export async function monitoredFunction() {
  const startTime = Date.now();

  try {
    const result = await yourFunction();

    metrics.increment('function.success', {
      function: 'yourFunction',
      endpoint: '/api/your-endpoint',
    });

    return result;
  } catch (error) {
    metrics.increment('function.error', {
      function: 'yourFunction',
      endpoint: '/api/your-endpoint',
      error: error.message,
    });

    throw error;
  } finally {
    metrics.timing('function.duration', Date.now() - startTime, {
      function: 'yourFunction',
    });
  }
}
```

### **2. Infrastructure Monitoring**

```yaml
# Example monitoring configuration
services:
  - name: 'eleva-care-health'
    url: 'https://eleva.care/api/healthcheck'
    method: 'GET'
    interval: 300 # 5 minutes
    timeout: 10
    expected_status: 200
    expected_body: '"status":"healthy"'

  - name: 'eleva-care-payout-cron'
    url: 'https://eleva.care/api/cron/check-upcoming-payouts'
    method: 'GET'
    headers:
      x-qstash-request: 'true'
    interval: 3600 # 1 hour
    timeout: 60
    expected_status: 200
    expected_body: '"success":true'
```

---

## 🔧 **Troubleshooting Quick Reference**

### **Common Issues & Solutions**

| **Issue**             | **Symptoms**                       | **Solution**                                           |
| --------------------- | ---------------------------------- | ------------------------------------------------------ |
| 401 Auth Errors       | `workflow.trigger()` calls fail    | Use `triggerWorkflow()` from `@/app/utils/novu`        |
| Missing Notifications | Users not receiving payouts alerts | Check Novu subscriber status and email/firstName data  |
| Slow Health Checks    | Response time > 5s                 | Check database connection pool and external API calls  |
| Cron Job Failures     | QStash returning errors            | Verify environment variables and QStash authentication |

### **Debug Commands**

```bash
# Test health check locally
curl -v http://localhost:3000/api/healthcheck

# Test payout processing
curl -v -H "x-qstash-request: true" http://localhost:3000/api/cron/check-upcoming-payouts

# Check Novu workflow status
npx novu sync --check

# Test notification triggering
npm run test tests/api/healthcheck.test.ts
```

---

**Remember**: The recent fixes ensure proper Novu authentication and reliable notification delivery. Monitor the patterns above to catch any regressions early! 🎯
