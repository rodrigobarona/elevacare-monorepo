# BetterStack Monitoring Guide

> **Complete guide to health monitoring, service checks, and heartbeat monitoring with BetterStack for Eleva Care**

## Overview

This guide covers the complete BetterStack monitoring setup for Eleva Care, including:

- **Monitors** (active checks) for API health endpoints
- **Heartbeats** (passive checks) for scheduled cron jobs
- Service health checks for all external dependencies
- Alert configuration and incident response

---

## Table of Contents

1. [Monitors vs Heartbeats](#monitors-vs-heartbeats)
2. [Health Check Implementation](#health-check-implementation)
3. [Setting Up Monitors](#setting-up-monitors)
4. [Heartbeat Monitoring](#heartbeat-monitoring)
5. [Alert Configuration](#alert-configuration)
6. [Testing & Verification](#testing--verification)
7. [Troubleshooting](#troubleshooting)

---

## Monitors vs Heartbeats

### Quick Comparison

| Feature       | **Monitors**                | **Heartbeats**                      |
| ------------- | --------------------------- | ----------------------------------- |
| **Purpose**   | Check if your service is UP | Check if your scheduled task RAN    |
| **Direction** | Better Stack → Your Service | Your Service → Better Stack         |
| **Type**      | Active (pull-based)         | Passive (push-based)                |
| **Use For**   | APIs, websites, servers     | Cron jobs, backups, batch processes |
| **Example**   | "Is eleva.care responding?" | "Did the database backup run?"      |

### When to Use Each

**Use Monitors When:**

- ✅ You have an HTTP endpoint to check
- ✅ You want to know if your service is **available**
- ✅ You need geographic distributed checks
- ✅ Response time matters
- ✅ SSL certificate validation needed

**Use Heartbeats When:**

- ✅ You have a scheduled task/cron job
- ✅ You want to know if a task **executed**
- ✅ The task runs on a schedule
- ✅ You need to capture execution logs
- ✅ You're monitoring batch processes

---

## Health Check Implementation

### Service Health Check Library

Location: `lib/service-health.ts`

Provides comprehensive health check functions for all external services:

- **Vercel** - Deployment and hosting status
- **Neon Database** - Main PostgreSQL database connectivity
- **Audit Database** - Audit log database connectivity
- **Stripe** - Payment API connectivity
- **Clerk** - Authentication API connectivity
- **Upstash Redis** - Cache connectivity and performance
- **Upstash QStash** - Job queue connectivity
- **Resend** - Email service API
- **PostHog** - Analytics service API
- **Novu** - Notification service API

Each health check returns:

- Service status (`healthy`, `degraded`, or `down`)
- Response time in milliseconds
- Detailed error messages if applicable
- Service-specific metadata

### Health Check Endpoints

#### Main Health Check: `/api/healthcheck`

**Features:**

- Query parameter `?services=true` for service summary
- Query parameter `?detailed=true` for full service details
- Auto-detection of Better Stack monitoring requests
- Proper HTTP status codes (200 for healthy, 503 for unhealthy)
- Support for `degraded` state (partial outage)

**Example Requests:**

```bash
# Basic health check
curl https://eleva.care/api/healthcheck

# With service summary
curl https://eleva.care/api/healthcheck?services=true

# With full details
curl https://eleva.care/api/healthcheck?detailed=true
```

#### Individual Service Health: `/api/health/[service]`

**List all services:**

```bash
curl https://eleva.care/api/health/_list
```

**Check individual services:**

```bash
curl https://eleva.care/api/health/stripe
curl https://eleva.care/api/health/neon-database
curl https://eleva.care/api/health/clerk
curl https://eleva.care/api/health/upstash-redis
curl https://eleva.care/api/health/resend
curl https://eleva.care/api/health/novu
```

**Response Format:**

```json
{
  "service": "stripe",
  "status": "healthy",
  "responseTime": 145,
  "message": "Stripe API connection successful (145ms)",
  "timestamp": "2024-01-14T10:00:00.000Z"
}
```

---

## Setting Up Monitors

### Recommended Monitor Configuration

#### 1. Quick Health Check (Primary Monitor)

```yaml
Monitor Type: HTTP
URL: https://eleva.care/api/healthcheck
Method: GET
Check Frequency: 30 seconds
Expected Status: 200
Request Timeout: 5 seconds
Regions: US, EU, Asia

Alerts:
  - After 2 failed checks → Alert immediately
  - Escalate to team after: 5 minutes
```

#### 2. Deep Service Health Check

```yaml
Monitor Type: HTTP
URL: https://eleva.care/api/healthcheck?services=true
Method: GET
Check Frequency: 5 minutes
Expected Status: 200
Request Timeout: 10 seconds
Regions: US, EU

Alerts:
  - After 3 failed checks → Alert
  - Escalate to team after: 10 minutes
```

#### 3. Critical Service Monitors

Check every 2 minutes:

- `https://eleva.care/api/health/stripe`
- `https://eleva.care/api/health/clerk`
- `https://eleva.care/api/health/neon-database`

Check every 5 minutes:

- `https://eleva.care/api/health/posthog`
- `https://eleva.care/api/health/resend`
- `https://eleva.care/api/health/novu`

### Creating Monitors via Dashboard

1. Navigate to Better Stack → **Uptime** → **Monitors**
2. Click **"Create Monitor"**
3. Configure:
   - **Monitor Type**: HTTP(S)
   - **URL**: `https://eleva.care/api/healthcheck`
   - **Name**: Eleva Care - Quick Health
   - **Check Frequency**: 30 seconds
   - **Expected Status Code**: 200
   - **Request Timeout**: 5 seconds
   - **Regions**: Select "US", "EU", "Asia"
4. Set Up Alerts:
   - **Alert after**: 2 consecutive failures
   - **Notify via**: Email, Push, SMS (optional)
   - **Escalate to team after**: 5 minutes
5. Save monitor

---

## Heartbeat Monitoring

### Cron Job Monitoring Strategy

#### Priority 1: CRITICAL 🔴 (Must Monitor)

**Financial operations that directly affect expert payouts and revenue**

| Cron Job                   | Schedule      | Why Critical                                                                  |
| -------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `process-expert-transfers` | Every 2 hours | Transfers funds to expert Connect accounts. Failure = experts don't get paid! |
| `process-pending-payouts`  | Daily         | Creates Stripe payouts to expert bank accounts. Failure = delayed payments!   |
| `send-payment-reminders`   | Every 6 hours | Sends Multibanco payment reminders. Failure = lost revenue!                   |

#### Priority 2: HIGH 🟠 (Should Monitor)

**Customer-facing communications**

| Cron Job                    | Schedule           | Why Important                                                              |
| --------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `appointment-reminders`     | Daily (24h before) | Sends 24-hour appointment reminders. Failure = no-shows & complaints!      |
| `appointment-reminders-1hr` | Hourly (1h before) | Sends 1-hour appointment reminders. Failure = missed meetings!             |
| `check-upcoming-payouts`    | Daily              | Notifies experts about upcoming payouts. Failure = poor expert experience! |

### Creating Heartbeat Monitors

#### Step 1: Create Heartbeat in Better Stack

1. Go to Better Stack → **Uptime** → **Heartbeats**
2. Click **"Create Heartbeat"**
3. Configure:

```yaml
Name: Expert Transfers
Period: 7200 seconds (2 hours)
Grace: 1440 seconds (24 minutes - 20% of period)

Notifications:
  ☑ Email
  ☑ Push
  ☑ Call (critical tasks only)

Escalation:
  Immediate alert
  Escalate to team after: 5 minutes
```

4. Save and copy the generated heartbeat URL
5. Add to `.env`:

```bash
BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/YOUR_TOKEN
```

#### Step 2: Implement Heartbeat in Code

**TypeScript Example:**

```typescript
import { env } from '@/config/env';

export async function notifyHeartbeat(
  heartbeatUrl: string,
  success: boolean = true,
  errorDetails?: string,
) {
  try {
    const url = success ? heartbeatUrl : `${heartbeatUrl}/fail`;
    const options = errorDetails
      ? {
          method: 'POST',
          body: JSON.stringify({ error: errorDetails }),
        }
      : {};

    await fetch(url, options);
  } catch (error) {
    console.error('Failed to notify heartbeat:', error);
  }
}

// In your cron job:
export async function processExpertTransfers() {
  try {
    // Your transfer logic here
    await performTransfers();

    // Notify success
    await notifyHeartbeat(env.BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT);
  } catch (error) {
    // Notify failure
    await notifyHeartbeat(env.BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT, false, error.message);
    throw error;
  }
}
```

### Environment Variables

Add to `.env` and Vercel:

```bash
# ============================================
# BetterStack Heartbeat Monitoring
# ============================================

# Critical Financial Jobs
BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_1
BETTERSTACK_PENDING_PAYOUTS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_2
BETTERSTACK_PAYMENT_REMINDERS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_3

# Customer Communication Jobs
BETTERSTACK_APPOINTMENT_REMINDERS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_4
BETTERSTACK_APPOINTMENT_REMINDERS_1HR_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_5
BETTERSTACK_UPCOMING_PAYOUTS_HEARTBEAT=https://uptime.betterstack.com/api/v1/heartbeat/TOKEN_6
```

---

## Alert Configuration

### Recommended Alert Settings

| Priority    | Email | Push | SMS | Call | Critical Alert | Team Wait |
| ----------- | ----- | ---- | --- | ---- | -------------- | --------- |
| 🚨 CRITICAL | ✅    | ✅   | ❌  | ❌   | ✅             | 5 min     |
| 🚨 HIGH     | ✅    | ✅   | ❌  | ❌   | ✅             | 10 min    |
| 📊 MEDIUM   | ✅    | ✅   | ❌  | ❌   | ❌             | 30 min    |
| ✅ LOW      | ✅    | ❌   | ❌  | ❌   | ❌             | 60 min    |

### Expected Response Times

| Service        | Healthy Threshold | Alert Threshold |
| -------------- | ----------------- | --------------- |
| Database       | < 100ms           | > 500ms         |
| Redis          | < 50ms            | > 200ms         |
| Stripe API     | < 500ms           | > 2000ms        |
| Clerk API      | < 500ms           | > 2000ms        |
| Resend API     | < 500ms           | > 2000ms        |
| Novu API       | < 500ms           | > 2000ms        |
| PostHog        | < 1000ms          | > 3000ms        |
| Overall Health | < 2000ms          | > 5000ms        |

### Status Meanings

| Status     | HTTP Code | Meaning                         | Action       |
| ---------- | --------- | ------------------------------- | ------------ |
| `healthy`  | 200       | Service fully operational       | ✅ No action |
| `degraded` | 200       | Service operational with issues | ⚠️ Monitor   |
| `down`     | 503       | Service unavailable             | 🚨 Alert     |

---

## Testing & Verification

### Test Service Health Library

```bash
# Start the dev server
pnpm dev

# Test individual services
curl http://localhost:3000/api/health/stripe
curl http://localhost:3000/api/health/neon-database
curl http://localhost:3000/api/health/clerk
curl http://localhost:3000/api/health/upstash-redis
curl http://localhost:3000/api/health/resend
curl http://localhost:3000/api/health/novu
```

### Test Enhanced Main Health Check

```bash
# Basic check
curl http://localhost:3000/api/healthcheck

# With services summary
curl http://localhost:3000/api/healthcheck?services=true

# With full details
curl http://localhost:3000/api/healthcheck?detailed=true
```

### Test Heartbeats

```bash
# Test success notification
curl -X POST "$BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT"

# Test failure notification
curl -X POST "$BETTERSTACK_EXPERT_TRANSFERS_HEARTBEAT/fail"
```

### Automated Test Script

Create `scripts/test-health.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "🧪 Testing Health Check System"
echo "================================"

# Test main health check
echo ""
echo "1️⃣ Testing main health check..."
curl -s "$BASE_URL/api/healthcheck" | jq '.status'

# Test with services
echo ""
echo "2️⃣ Testing health check with services..."
curl -s "$BASE_URL/api/healthcheck?services=true" | jq '.services.summary'

# Test service list
echo ""
echo "3️⃣ Listing available services..."
curl -s "$BASE_URL/api/health/_list" | jq '.services'

# Test each service
echo ""
echo "4️⃣ Testing individual services..."
SERVICES=("stripe" "neon-database" "clerk" "upstash-redis" "resend" "novu")

for service in "${SERVICES[@]}"; do
  echo "   Testing $service..."
  STATUS=$(curl -s "$BASE_URL/api/health/$service" | jq -r '.status')
  RESPONSE_TIME=$(curl -s "$BASE_URL/api/health/$service" | jq -r '.responseTime')
  echo "   ✅ $service: $STATUS (${RESPONSE_TIME}ms)"
done

echo ""
echo "================================"
echo "✅ All tests completed!"
```

Run with:

```bash
chmod +x scripts/test-health.sh
./scripts/test-health.sh
```

---

## Troubleshooting

### Service Shows Down Locally

**Symptoms:** Individual service endpoint returns `down` status

**Possible Causes:**

1. Missing environment variable
2. API credentials expired
3. Network connectivity issue
4. Service actually down

**Solutions:**

```bash
# Check environment variables
curl http://localhost:3000/api/healthcheck | jq '.config'

# Check specific service
curl -v http://localhost:3000/api/health/stripe

# Review logs (check console output)
```

### High Response Times

**Symptoms:** Health checks take > 2 seconds

**Possible Causes:**

1. Cold start (serverless)
2. Network latency
3. Database query performance
4. External API slowness

**Solutions:**

- Review the `responseTime` field in the response
- Check which service is slow
- Optimize that specific service
- Consider caching or reducing check frequency

### False Positives in Production

**Symptoms:** Better Stack reports service down but it's working

**Possible Causes:**

1. Rate limiting
2. Geographic restrictions
3. Firewall rules

**Solutions:**

- Increase check frequency to 60+ seconds
- Whitelist Better Stack IP ranges
- Check service logs for rate limit errors

### Heartbeat Not Receiving Signals

**Symptoms:**

- BetterStack shows "Down" status
- No recent heartbeat received

**Solutions:**

1. Check environment variable is set correctly
2. Verify cron job is running (check QStash logs)
3. Test heartbeat URL manually with `curl`
4. Check network connectivity from Vercel

### False Positive Heartbeat Alerts

**Symptoms:**

- Alerts triggered but job succeeded
- Heartbeat received after grace period

**Solutions:**

1. Increase grace period (20-30% of period)
2. Check for network latency issues
3. Review job execution time

---

## Integration with Existing Systems

### PostHog Analytics ✅

All health checks are tracked in PostHog:

- `health_check_success` events
- `health_check_failed` events
- Service status and response time metrics

### Novu Notifications ✅

Critical health failures trigger Novu notifications:

- System unhealthy states
- Database connection failures
- Critical service outages

### QStash Monitoring ✅

Maintains compatibility with existing QStash health checks:

- Header detection (`x-qstash-request`)
- Test message handling
- Scheduled health probes

---

## Maintenance

### Weekly

- [ ] Review alert frequency
- [ ] Check false positive rate
- [ ] Review response times
- [ ] Analyze heartbeat patterns

### Monthly

- [ ] Update alert thresholds
- [ ] Review incident history
- [ ] Test disaster recovery
- [ ] Review escalation policy

### Quarterly

- [ ] Review escalation policies
- [ ] Audit notification channels
- [ ] Update documentation
- [ ] Evaluate need for additional monitors

---

## Quick Reference

### Create Monitor (Dashboard)

1. Uptime → Monitors → Create Monitor
2. Enter URL and frequency
3. Configure alerts
4. Save

### Create Heartbeat (Dashboard)

1. Uptime → Heartbeats → Create Heartbeat
2. Set period and grace
3. Configure notifications
4. Copy URL and add to code

### Test Endpoints

```bash
# Health check
curl https://eleva.care/api/healthcheck

# Service health
curl https://eleva.care/api/health/stripe

# Heartbeat test
curl -X POST $BETTERSTACK_HEARTBEAT_URL
```

---

**Last Updated**: January 2025  
**Maintained By**: Engineering Team  
**Questions?** Post in #engineering Slack channel
