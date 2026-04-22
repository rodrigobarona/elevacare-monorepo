# Health Check Monitoring System

## Overview

This document outlines the health check monitoring system implemented in the Eleva Care application. We've consolidated our health monitoring into comprehensive endpoints that serve multiple purposes including CI/CD monitoring, QStash testing, general API health verification, PostHog analytics, Novu notifications, and Better Stack status page monitoring.

> **📊 Better Stack Integration:** For setting up status page monitoring with Better Stack, see the [Better Stack Integration Guide](./02-betterstack-integration.md) and [Quick Reference](./betterstack-quick-reference.md).

## Endpoint Details

### Primary Endpoints

#### 1. Comprehensive Health Check

```
/api/healthcheck
```

**Supported Methods:**

- `GET`: Returns comprehensive system health information
- `POST`: Handles QStash message testing

**Query Parameters:**

- `?services=true` - Include service health summary
- `?detailed=true` - Include detailed service health checks (all services)

#### 2. Individual Service Health Checks

```
/api/health/[service]
```

**Supported Methods:**

- `GET`: Returns health status for a specific service

**Available Services:**

- `vercel` - Vercel deployment status
- `neon-database` - Main Neon PostgreSQL database
- `audit-database` - Audit log database
- `stripe` - Stripe payment API
- `clerk` - Clerk authentication API
- `upstash-redis` - Redis cache
- `upstash-qstash` - QStash job queue
- `resend` - Resend email service
- `posthog` - PostHog analytics
- `novu` - Novu notification service

**Special Endpoint:**

```
/api/health/_list
```

Returns a list of all available services for health checks.

### Response Format

#### GET Response

```json
{
  "status": "healthy",
  "version": "x.x.x",
  "timestamp": "ISO-8601 timestamp",
  "uptime": "server uptime in seconds",
  "memory": {
    "used": "used memory in MB",
    "total": "total memory in MB",
    "free": "free memory in MB"
  },
  "environment": "development|staging|production",
  "nodeVersion": "current Node.js version",
  "platform": "operating system"
}
```

#### POST Response (QStash)

```json
{
  "success": true,
  "message": "QStash message received",
  "timestamp": "ISO-8601 timestamp"
}
```

## Integration Points

### CI/CD Monitoring

- Used in deployment verification
- No authentication required for basic health checks
- Monitors system availability and basic functionality

### QStash Integration

- Handles webhook verification
- Tests message processing functionality
- Verifies background job infrastructure

### System Monitoring

- Provides detailed system metrics
- Tracks memory usage and performance
- Reports environment-specific information

### PostHog Analytics

- Tracks all health check interactions
- Captures success and failure events
- Provides metrics for:
  - Response times
  - Success rates
  - Memory usage trends
  - System uptime
  - Error patterns

### Novu Notifications

- Sends instant alerts for health check failures
- Configurable notification templates
- Supports multiple channels (email, SMS, etc.)
- Customizable alert thresholds

## Configuration

### Environment Variables

```env
# PostHog Configuration
POSTHOG_API_KEY=your_posthog_api_key
POSTHOG_HOST=https://app.posthog.com  # Or your self-hosted instance URL

# Novu Configuration
NOVU_API_KEY=your_novu_api_key
NOVU_ADMIN_SUBSCRIBER_ID=admin  # The subscriber ID to receive notifications
```

### PostHog Events

The system tracks the following events in PostHog:

1. `health_check_success`
   - Triggered on successful health checks
   - Includes system metrics and response data

2. `health_check_failed`
   - Triggered on health check failures
   - Includes error details and system state

### Novu Templates

Required Novu notification template:

1. `health-check-failure`
   - Triggered on health check failures
   - Customizable message template
   - Includes:
     - Timestamp
     - Error details
     - Environment info
     - System metrics

## Novu Notification Template

### Template ID: `health-check-failure`

The health check failure notification template is configured in Novu with the following structure:

#### Email Template

```html
<h2>⚠️ Health Check Failure Alert</h2>

<p>A health check failure has been detected in the Eleva Care application.</p>

<h3>System Details</h3>
<ul>
  <li><strong>Status:</strong> {{status}}</li>
  <li><strong>Error:</strong> {{error}}</li>
  <li><strong>Environment:</strong> {{environment}}</li>
  <li><strong>Timestamp:</strong> {{timestamp}}</li>
  <li><strong>Version:</strong> {{version}}</li>
  <li><strong>Node Version:</strong> {{nodeVersion}}</li>
</ul>

<h3>Memory Usage</h3>
<ul>
  <li><strong>Used:</strong> {{memory.used}}MB</li>
  <li><strong>Total:</strong> {{memory.total}}MB</li>
  <li><strong>Usage:</strong> {{memory.percentage}}%</li>
</ul>

<h3>System Information</h3>
<ul>
  <li><strong>Uptime:</strong> {{uptime}} seconds</li>
  <li><strong>Platform:</strong> {{platform}}</li>
  <li><strong>Architecture:</strong> {{arch}}</li>
</ul>

<h3>Environment Configuration</h3>
<ul>
  <li>
    <strong>Database:</strong> {{#if config.hasDatabase}}Connected✅{{else}}Disconnected❌{{/if}}
  </li>
  <li><strong>Auth:</strong> {{#if config.hasAuth}}Enabled✅{{else}}Disabled❌{{/if}}</li>
  <li><strong>Stripe:</strong> {{#if config.hasStripe}}Connected✅{{else}}Disconnected❌{{/if}}</li>
  <li>
    <strong>Redis:</strong> {{#if config.hasRedis}}Connected✅
    ({{config.redisMode}}){{else}}Disconnected❌{{/if}}
  </li>
  <li><strong>QStash:</strong> {{#if config.hasQStash}}Connected✅{{else}}Disconnected❌{{/if}}</li>
  <li>
    <strong>Email:</strong> {{#if config.hasEmail}}Configured✅{{else}}Not Configured❌{{/if}}
  </li>
  <li><strong>Novu:</strong> {{#if config.hasNovu}}Connected✅{{else}}Disconnected❌{{/if}}</li>
</ul>

<p><a href="{{config.baseUrl}}/admin/monitoring">View Monitoring Dashboard</a></p>
```

#### In-App Template

```html
⚠️ Health Check Failure: {{error}} ({{environment}})
```

#### SMS Template

```
🚨 Eleva Care Health Alert: {{error}} in {{environment}} at {{timestamp}}. Check monitoring dashboard.
```

## PostHog Dashboards

### 1. Health Check Overview Dashboard

This dashboard provides a high-level view of system health:

- **Metrics**:
  - Health Check Success Rate (24h)
  - Average Response Time
  - Memory Usage Trends
  - Error Rate by Environment
  - Service Uptime

- **Visualizations**:
  - Status Distribution Pie Chart
  - Memory Usage Line Graph
  - Error Count Timeline
  - Environment Health Matrix

### 2. System Performance Dashboard

This dashboard focuses on detailed system metrics:

- **Metrics**:
  - Memory Usage by Component
  - CPU Load Average
  - Service Dependencies Status
  - Request Latency Distribution
  - Error Types Distribution

- **Visualizations**:
  - Memory Usage Heatmap
  - Dependency Health Status Grid
  - Error Type Breakdown
  - Performance Trends

### PostHog Event Schema

The health check system tracks the following events:

1. `health_check_success`

   ```typescript
   {
     status: 'healthy',
     timestamp: string,
     source: 'qstash' | 'ci-cd' | 'direct',
     uptime: number,
     version: string,
     environment: string,
     memory: {
       used: number,
       total: number,
       percentage: number
     },
     config: {
       hasDatabase: boolean,
       hasAuth: boolean,
       hasStripe: boolean,
       hasRedis: boolean,
       redisMode: string,
       hasQStash: boolean,
       hasEmail: boolean,
       hasNovu: boolean
     }
   }
   ```

2. `health_check_failed`
   ```typescript
   {
     status: 'unhealthy',
     error: string,
     timestamp: string,
     environment: string,
     // ... same fields as success event
   }
   ```

## Integration Setup

1. **Novu Configuration**:
   - Create the `health-check-failure` template in Novu dashboard
   - Configure email, SMS, and in-app channels
   - Set up subscriber groups for alerts

2. **PostHog Configuration**:
   - Create the Health Check Overview dashboard
   - Create the System Performance dashboard
   - Set up alerts for critical metrics
   - Configure retention policies for health check data

## Alert Thresholds

- Memory Usage > 90%
- Error Rate > 5% in 5 minutes
- Response Time > 2000ms
- Dependency Failures > 2 consecutive checks

## Monitoring Best Practices

1. **Regular Review**:
   - Monitor dashboard trends daily
   - Review error patterns weekly
   - Adjust thresholds based on patterns

2. **Incident Response**:
   - Document all health check failures
   - Track resolution time
   - Update runbooks based on incidents

3. **Maintenance**:
   - Regular threshold review
   - Dashboard optimization
   - Alert configuration updates

## Future Enhancements

1. **Monitoring**:
   - Add custom metrics tracking
   - Implement ML-based anomaly detection
   - Enhanced visualization components

2. **Alerting**:
   - Tiered alert levels
   - Custom notification rules
   - Integration with incident management

3. **Analytics**:
   - Trend analysis
   - Predictive maintenance
   - Capacity planning insights

## Cron Jobs Overview

The following cron jobs are configured in our system:

1. Process Tasks
   - Schedule: Daily at 4 AM
   - Purpose: Background task processing

2. Expert Transfers
   - Schedule: Every 2 hours
   - Purpose: Process expert payment transfers

3. Upcoming Payouts
   - Schedule: Daily at noon
   - Purpose: Check and prepare upcoming payments

4. Reservation Cleanup
   - Schedule: Every 15 minutes
   - Purpose: Remove expired reservations

5. Blocked Dates Cleanup
   - Schedule: Daily at midnight
   - Purpose: Clean up expired blocked dates

6. Appointment Reminders
   - Schedule: Daily at 9 AM
   - Purpose: Send appointment notifications

7. Keep-alive
   - Schedule: Periodic
   - Purpose: Database health verification

## Best Practices

### Monitoring

1. Set up alerts for:
   - Response times > 1000ms
   - 5xx errors
   - Memory usage > 80%
   - Sustained high CPU usage

### Testing

1. Include health check in integration tests
2. Verify both GET and POST endpoints
3. Test error scenarios and recovery
4. Validate PostHog event tracking
5. Test Novu notification delivery

### Security

1. Rate limiting implemented
2. No sensitive information in responses
3. Basic monitoring doesn't require authentication
4. PostHog API key securely stored
5. Novu API key properly managed

## Analytics & Alerting

### PostHog Dashboards

1. Health Check Overview
   - Success rate over time
   - Average response time
   - Error frequency
   - Memory usage trends

2. System Performance
   - CPU utilization
   - Memory consumption
   - Uptime tracking
   - Error patterns

### Novu Alert Rules

1. Immediate Alerts
   - Any 5xx errors
   - Memory usage > 90%
   - Response time > 2000ms

2. Aggregated Reports
   - Daily health summary
   - Weekly performance trends
   - Monthly uptime report

## Future Enhancements

1. Enhanced metrics collection
2. Historical data tracking
3. Performance trending
4. Integration with additional monitoring services
5. Advanced PostHog analytics
6. Multi-channel Novu alerts

## Troubleshooting

### Common Issues

1. Endpoint returns 5xx
   - Check server logs
   - Verify database connectivity
   - Check memory usage
   - Review PostHog events
   - Check Novu delivery status

2. Slow Response Times
   - Monitor system resources
   - Check database query performance
   - Verify network connectivity
   - Analyze PostHog metrics

### Support

For issues or questions:

1. Check PostHog dashboards for patterns
2. Review Novu notification history
3. Contact the DevOps team
4. Create an issue in the project repository
