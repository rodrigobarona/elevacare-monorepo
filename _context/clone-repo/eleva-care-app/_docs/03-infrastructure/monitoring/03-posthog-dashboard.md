# PostHog Dashboard Setup Guide

## Overview

This guide covers multiple approaches to implement PostHog dashboards for the Eleva Care application, including automated API setup and manual UI configuration.

## Option 1: Automated Setup via API (Recommended)

### Prerequisites

1. **PostHog API Key**: Get your personal API key from PostHog settings
2. **Project ID**: Your PostHog project identifier

### Environment Variables

Add these to your `.env.local` file:

```env
# ========================================
# 🌐 PUBLIC Variables (Client-side tracking)
# ========================================
# These MUST have NEXT_PUBLIC_ prefix to work in the browser
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# ========================================
# 🔒 PRIVATE Variables (Server-side API)
# ========================================
# These must NOT have NEXT_PUBLIC_ prefix (server-side only)
POSTHOG_API_KEY=phx_your_personal_api_key_here
POSTHOG_PROJECT_ID=your_project_id_here
```

### Variable Breakdown

| Variable                   | Type        | Purpose                                 | Used In                         |
| -------------------------- | ----------- | --------------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | **Public**  | Project API key for browser tracking    | Client-side tracking, analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | **Public**  | PostHog instance URL                    | Client-side tracking            |
| `POSTHOG_API_KEY`          | **Private** | Personal API key for dashboard creation | Server-side scripts only        |
| `POSTHOG_PROJECT_ID`       | **Private** | Project identifier for API operations   | Server-side scripts only        |

⚠️ **Security Note**: Never use `NEXT_PUBLIC_` prefix for personal API keys or project IDs as they would be exposed to all website visitors.

### Getting Your PostHog Credentials

1. **API Key**:
   - Go to PostHog → Settings → Personal API Keys
   - Create a new key with dashboard creation permissions
   - Copy the key (starts with `phx_`)

2. **Project ID**:
   - In your PostHog URL: `https://app.posthog.com/project/12345`
   - The number `12345` is your project ID

3. **Project API Key**:
   - Go to PostHog → Settings → Project Settings
   - Copy the "Project API Key" (starts with `phc_`)

### API Key Permissions & Security

#### 🔐 **Required Scopes for Dashboard Automation**

When creating your personal API key, select **only these minimal permissions**:

```
✅ REQUIRED:
├── 📊 Dashboards: Read + Write
├── 📈 Insights: Read + Write
└── 🏗️ Project Settings: Read (for validation)

❌ NOT REQUIRED (keep disabled for security):
├── Events: Write
├── Persons: Read/Write
├── Feature Flags: Read/Write
├── Cohorts: Read/Write
├── Session Recordings: Read
├── Experiments: Read/Write
├── Data Management: Read/Write
└── Organization Admin (⚠️ NEVER enable!)
```

#### 🎯 **Step-by-Step Permission Setup**

1. **Navigate**: PostHog → Settings → Personal API Keys
2. **Click**: "Create API Key"
3. **Name**: "Dashboard Automation - Eleva Care"
4. **Description**: "Automated dashboard creation via API"
5. **Scopes**: Select only:
   - ✅ **Dashboards**: View + Edit
   - ✅ **Insights**: View + Edit
   - ✅ **Project**: View (for connection testing)
6. **Project Access**: Select your specific project only
7. **Expiration**: Set to 1 year (review annually)

#### 🔒 **Security Best Practices**

**Key Management:**

- ✅ Store in `.env.local` (never commit to git)
- ✅ Use different keys for dev/staging/production
- ✅ Set reasonable expiration dates (max 1 year)
- ✅ Add description with purpose and date created
- ✅ Review and rotate keys regularly

**Access Control:**

- ✅ Principle of least privilege (minimal scopes only)
- ✅ Project-specific keys (not organization-wide)
- ✅ Monitor API key usage in PostHog
- ✅ Revoke immediately if compromised

**Environment Separation:**

```env
# ✅ Good: Environment-specific keys
POSTHOG_API_KEY_DEV=phx_dev_specific_key
POSTHOG_API_KEY_PROD=phx_prod_specific_key

# ❌ Bad: Same key across environments
POSTHOG_API_KEY=phx_shared_key_everywhere
```

#### ⚠️ **What NOT to Include**

**Never grant these permissions for dashboard automation:**

- **Organization Admin** - Can modify billing, delete projects
- **Data Management** - Can delete all your analytics data
- **Events Write** - Can inject false analytics data
- **Persons Write** - Can modify user profiles
- **Feature Flags** - Can change application behavior

**These permissions are dangerous and unnecessary for dashboard creation!**

### Running the Setup Script

```bash
# Install dependencies if needed
npm install

# Run the dashboard setup
npm run setup:posthog-dashboards

# Alternative direct execution
node scripts/setup-posthog-dashboards.js
```

### What the Script Creates

The script automatically creates 5 comprehensive dashboards:

1. **Application Overview** - DAU, page views, authentication rates
2. **Health Check Monitoring** - System health, memory usage, environment status
3. **User Experience** - Page performance, user journeys, feature flags
4. **Business Intelligence** - Conversion funnels, revenue, business events
5. **Technical Performance** - Error rates, API performance, Core Web Vitals

### Script Output

```
🚀 Setting up PostHog dashboards for Eleva Care...

📊 Creating dashboard: Application Overview
✅ Dashboard created with ID: 123
  📈 Adding tile: Daily Active Users
  📈 Adding tile: Page Views by Route Type
  📈 Adding tile: User Authentication Rate
  📈 Adding tile: Error Rate Trends
✅ Dashboard "Application Overview" setup complete

[... similar output for other dashboards ...]

🎉 All dashboards created successfully!

Created dashboards:
  - Application Overview: https://app.posthog.com/project/12345/dashboard/123
  - Health Check Monitoring: https://app.posthog.com/project/12345/dashboard/124
  - User Experience: https://app.posthog.com/project/12345/dashboard/125
  - Business Intelligence: https://app.posthog.com/project/12345/dashboard/126
  - Technical Performance: https://app.posthog.com/project/12345/dashboard/127

📝 Dashboard URLs saved to docs/posthog-dashboard-urls.json
```

## Option 2: Manual Setup via PostHog UI

If you prefer manual setup or need to customize further:

### 1. Application Overview Dashboard

Navigate to PostHog → Dashboards → New Dashboard

**Create the following insights:**

#### Daily Active Users

```sql
SELECT count(distinct(person_id))
FROM events
WHERE event = '$pageview'
AND timestamp >= now() - interval '30 days'
GROUP BY toDate(timestamp)
```

#### Page Views by Route Type

```sql
SELECT
  properties.route_type,
  count() as page_views
FROM events
WHERE event = '$pageview'
AND timestamp >= now() - interval '7 days'
GROUP BY properties.route_type
```

#### User Authentication Rate

```sql
SELECT
  properties.user_authenticated,
  count() as views
FROM events
WHERE event = '$pageview'
GROUP BY properties.user_authenticated
```

#### Error Rate Trends

```sql
SELECT
  toHour(timestamp) as hour,
  count() as errors
FROM events
WHERE event = 'javascript_error'
AND timestamp >= now() - interval '24 hours'
GROUP BY hour
ORDER BY hour
```

### 2. Health Check Monitoring Dashboard

#### Health Check Success Rate

```sql
SELECT
  event,
  count() as count
FROM events
WHERE event IN ('health_check_success', 'health_check_failed')
AND timestamp >= now() - interval '24 hours'
GROUP BY event
```

#### Memory Usage Distribution

```sql
SELECT
  toHour(timestamp) as hour,
  avg(toFloat64(JSONExtractString(properties, 'memory.percentage'))) as avg_memory
FROM events
WHERE event IN ('health_check_success', 'health_check_failed')
GROUP BY hour
ORDER BY hour
```

### 3. User Experience Dashboard

#### Page Load Performance

```sql
SELECT
  JSONExtractString(properties, 'pathname') as page,
  avg(toFloat64(JSONExtractString(properties, 'load_time'))) as avg_load_time
FROM events
WHERE event = 'page_performance'
GROUP BY page
ORDER BY avg_load_time DESC
```

#### User Journey Funnel

Create a funnel with these steps:

1. `$pageview` (Page View)
2. `user_signed_in` (Sign In)
3. `business_appointment_booked` (Booking)

### 4. Business Intelligence Dashboard

#### Conversion Funnel

Create a funnel with these steps:

1. `$pageview` (Page Visit)
2. `business_expert_contacted` (Expert Contact)
3. `business_appointment_booked` (Appointment)
4. `business_payment_completed` (Payment)

#### Business Events Trends

```sql
SELECT
  toDate(timestamp) as date,
  event,
  count() as event_count
FROM events
WHERE event IN ('business_appointment_booked', 'business_payment_completed', 'business_expert_contacted')
GROUP BY date, event
ORDER BY date DESC
```

### 5. Technical Performance Dashboard

#### JavaScript Error Rate by Page

```sql
SELECT
  JSONExtractString(properties, 'pathname') as page,
  count() as errors
FROM events
WHERE event = 'javascript_error'
GROUP BY page
ORDER BY errors DESC
```

#### API Performance

```sql
SELECT
  JSONExtractString(properties, 'endpoint') as endpoint,
  avg(toFloat64(JSONExtractString(properties, 'value'))) as avg_response_time
FROM events
WHERE event = 'performance_metric'
AND JSONExtractString(properties, 'metric') = 'api_call_time'
GROUP BY endpoint
ORDER BY avg_response_time DESC
```

## Option 3: Infrastructure as Code (Advanced)

For teams using infrastructure as code, you can integrate dashboard creation into your deployment pipeline:

### Terraform Provider

```hcl
# terraform/posthog.tf
terraform {
  required_providers {
    posthog = {
      source = "PostHog/posthog"
      version = "~> 0.1"
    }
  }
}

provider "posthog" {
  api_key = var.posthog_api_key
  host    = var.posthog_host
}

resource "posthog_dashboard" "application_overview" {
  name        = "Application Overview"
  description = "High-level application health and usage metrics"
  pinned      = true
}

resource "posthog_insight" "daily_active_users" {
  name = "Daily Active Users"
  query = jsonencode({
    kind = "EventsQuery"
    select = ["count(distinct(person_id))"]
    event = "$pageview"
    interval = "day"
    dateRange = { date_from = "-30d" }
  })
  dashboards = [posthog_dashboard.application_overview.id]
}
```

### GitHub Actions Integration

```yaml
# .github/workflows/setup-posthog-dashboards.yml
name: Setup PostHog Dashboards

on:
  workflow_dispatch:
  push:
    branches: [main]
    paths: ['scripts/setup-posthog-dashboards.js']

jobs:
  setup-dashboards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Setup PostHog Dashboards
        run: npm run setup:posthog-dashboards
        env:
          POSTHOG_API_KEY: ${{ secrets.POSTHOG_API_KEY }}
          POSTHOG_PROJECT_ID: ${{ secrets.POSTHOG_PROJECT_ID }}
          NEXT_PUBLIC_POSTHOG_HOST: ${{ vars.NEXT_PUBLIC_POSTHOG_HOST }}
```

## Option 4: PostHog CLI (Limited)

PostHog doesn't have a comprehensive CLI, but you can use curl for simple operations:

```bash
# Create a dashboard
curl -X POST "https://app.posthog.com/api/projects/${PROJECT_ID}/dashboards/" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Dashboard",
    "description": "Dashboard created via CLI",
    "pinned": true
  }'

# Create an insight
curl -X POST "https://app.posthog.com/api/projects/${PROJECT_ID}/insights/" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Page Views",
    "query": {
      "kind": "EventsQuery",
      "select": ["count()"],
      "event": "$pageview"
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify your API key is correct and has the right permissions
   - Check that your project ID matches your PostHog project

2. **Query Syntax Errors**
   - PostHog uses HogQL for queries
   - Refer to [PostHog HogQL documentation](https://posthog.com/docs/hogql)

3. **Missing Data**
   - Ensure events are being tracked correctly
   - Check that property names match your implementation

4. **Rate Limiting**
   - The script includes delays between API calls
   - If you hit rate limits, increase the delay in the script

### Getting Help

1. **PostHog Documentation**: https://posthog.com/docs
2. **API Reference**: https://posthog.com/docs/api
3. **Community Slack**: https://posthog.com/slack
4. **GitHub Issues**: https://github.com/PostHog/posthog

## Maintenance

### Regular Updates

1. **Weekly**: Review dashboard performance and accuracy
2. **Monthly**: Update queries based on new events or properties
3. **Quarterly**: Archive unused dashboards and insights

### Version Control

Keep your dashboard configurations in version control:

```bash
# Export current dashboards
node scripts/export-posthog-dashboards.js

# Commit changes
git add docs/posthog-dashboard-configs/
git commit -m "Update PostHog dashboard configurations"
```

### Backup and Recovery

```javascript
// scripts/backup-posthog-dashboards.js
const { postHogAPI } = require('./setup-posthog-dashboards');

async function backupDashboards() {
  const dashboards = await postHogAPI('dashboards/');

  for (const dashboard of dashboards.results) {
    const fullDashboard = await postHogAPI(`dashboards/${dashboard.id}/`);

    fs.writeFileSync(
      `backups/dashboard-${dashboard.id}-${Date.now()}.json`,
      JSON.stringify(fullDashboard, null, 2),
    );
  }
}
```

## Best Practices

1. **Start with the API approach** - It's faster and more reliable
2. **Test queries manually first** - Validate your HogQL queries in PostHog UI
3. **Use version control** - Keep dashboard configurations in git
4. **Monitor performance** - Complex queries can slow down dashboards
5. **Set up alerts** - Use PostHog's alerting for critical metrics
6. **Document changes** - Keep a changelog of dashboard modifications

This comprehensive approach gives you full control over your PostHog dashboards while maintaining automation and version control.
