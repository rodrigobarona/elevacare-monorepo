# BetterStack Integration

## Overview

Eleva Care integrates with BetterStack Uptime to provide real-time system status monitoring on the website footer. This integration displays the current health status of all monitored services to users.

## Features

- **Real-time Status Display**: Shows current system health with visual indicators
- **Automatic Status Calculation**: Calculates overall health based on all monitor statuses
- **Visual Indicators**:
  - 🟢 Green: All systems operational
  - 🟠 Orange: Partial outage
  - 🔴 Red: Degraded performance
  - ⚪ Gray: Unable to fetch status
- **Animated Pulse Effect**: Visual animation for attention
- **Link to Status Page**: Direct link to detailed status page

## Architecture

### Components

1. **ServerStatus Component** (`components/atoms/ServerStatus.tsx`)
   - **Server Component** (default in Next.js 15 App Router)
   - Fetches directly from BetterStack API on the server
   - Keeps API key secure (never exposed to client)
   - Calculates system health percentage
   - Renders status indicator with animated pulse effect
   - **Multilingual** using next-intl (English, Spanish, Portuguese, Brazilian Portuguese)
   - Cached for 180 seconds using Next.js `revalidate`
   - Next.js bundler automatically prevents client-side import

2. **Status Component** (`components/atoms/Status.tsx`) - **DEPRECATED**
   - Legacy client-side implementation
   - Kept for backward compatibility
   - Use `ServerStatus` for new implementations

3. **Status API Route** (`app/api/status/route.ts`) - **OPTIONAL**
   - Alternative approach using API route
   - Only needed if you must use client-side fetching
   - Use `ServerStatus` directly instead when possible

4. **BetterStack Types** (`types/betterstack.ts`)
   - TypeScript type definitions for BetterStack API responses
   - Ensures type safety across the integration

5. **Configuration** (`config/betterstack.ts`)
   - Centralized configuration for BetterStack settings
   - Environment variable validation
   - Status color and label mappings

### Data Flow (Recommended Approach)

```text
BetterStack API
      ↓
ServerStatus Component (Server)
      ↓  (Cached 180s)
Footer Component (Server)
      ↓  (HTML + Hydration)
Client (Browser)
```

### Why This Architecture? ✅

**Server Component Composition Pattern**:

- Footer is a **Server Component** by default
- Uses **Composition Pattern** to include client components (LanguageSwitcher, CookiePreferencesButton)
- ServerStatus fetches data on the server, rendered as HTML
- No JavaScript needed for status display

**Security** 🔒:

- API key **never** leaves the server
- No API routes needed (direct server-to-server communication)
- Zero risk of key exposure in browser

**Performance** ⚡:

- **Zero JavaScript** for status indicator
- Server-side rendering (instant display)
- Server-side caching (180s)
- No client-side fetch overhead
- Faster Time to First Byte (TTFB)

**SEO** 🔍:

- Status rendered in HTML (crawlable)
- No JavaScript required for content visibility

## Setup

### 1. Get BetterStack API Key

1. Log in to your [BetterStack account](https://uptime.betterstack.com/)
2. Navigate to **Settings** → **API Tokens**
3. Click **Create API Token**
4. Give it a name (e.g., "Eleva Care Status")
5. Select permissions: **Read Monitors**
6. Copy the generated API key

### 2. Get Status Page URL

1. In BetterStack, navigate to **Status Pages**
2. Copy the URL of your status page (e.g., `https://status.eleva.care`)

### 3. Configure Environment Variables

Add the following to your `.env` file:

```bash
# BetterStack Uptime Monitoring
BETTERSTACK_API_KEY="your_api_key_here"
BETTERSTACK_URL="https://status.eleva.care"
```

### 4. Verify Configuration

The Status component will automatically validate the configuration. If the environment variables are missing, the component will return `null` and not display anything.

## Usage

### Recommended: Server Component (Current Implementation)

The ServerStatus component is automatically included in the Footer:

```tsx
import { ServerStatus } from '@/components/atoms/ServerStatus';

// Footer is a Server Component (no 'use client')
export default function Footer() {
  return (
    <footer>
      {/* Other footer content */}
      <ServerStatus /> {/* Fetches on server, renders as HTML */}
    </footer>
  );
}
```

### Alternative: Client Component (Legacy)

If you need client-side fetching (not recommended):

```tsx
'use client';

import { Status } from '@/components/atoms/Status';

export default function ClientComponent() {
  return (
    <div>
      <Status /> {/* Fetches from /api/status */}
    </div>
  );
}
```

## API Reference

### ServerStatus Component (Recommended)

Server-side component that fetches and displays system status.

**Type**: Async Server Component

**Props**: None (uses environment variables)

**Behavior**:

- Fetches directly from BetterStack API on server
- Calculates overall system health
- Renders HTML with status indicator
- Supports multiple languages (en, es, pt, br) via next-intl
- Cached for 180 seconds (Next.js `revalidate`)

**Environment Variables**:

- `BETTERSTACK_API_KEY` (required): BetterStack API authentication key
- `BETTERSTACK_URL` (required): Status page URL for user navigation

**Example**:

```tsx
import { ServerStatus } from '@/components/atoms/ServerStatus';

export default function Page() {
  return (
    <div>
      <ServerStatus /> {/* Async Server Component */}
    </div>
  );
}
```

**Returns**: `null` if environment variables are not configured

### Status Component (Legacy - Client-Side)

Client-side component that displays system status indicator.

**Type**: Client Component

**Props**: None

**Behavior**:

- Fetches status from `/api/status` endpoint on mount
- Auto-refreshes every 60 seconds
- Shows loading state initially ("Checking status...")
- Handles errors gracefully

**Example**:

```tsx
'use client';

import { Status } from '@/components/atoms/Status';

export function ClientComponent() {
  return <Status />;
  {
    /* Requires client-side context */
  }
}
```

### Status API Route (Optional)

**Endpoint**: `GET /api/status`

**Access**: Public (no authentication required)

**Purpose**: Provides status data for client-side components (legacy support)

**Response**:

```typescript
{
  color: string; // Tailwind class: 'bg-green-500', 'bg-orange-500', etc.
  label: string; // 'All systems normal', 'Partial outage', etc.
  url: string | null; // Status page URL
}
```

**Caching**:

- Server-side: 180 seconds (Next.js `revalidate`)
- HTTP: `Cache-Control: public, s-maxage=180, stale-while-revalidate=30`

**Middleware Configuration**:

The `/api/status` endpoint is explicitly allowed in `middleware.ts` as a public route, bypassing authentication requirements. This ensures the status indicator can be displayed to all users, including non-authenticated visitors.

**Note**: Use `ServerStatus` component directly instead of this API route when possible

### BetterStack API

**Endpoint**: `https://uptime.betterstack.com/api/v2/monitors`

**Method**: GET

**Headers**:

```typescript
{
  Authorization: `Bearer ${BETTERSTACK_API_KEY}`;
}
```

**Response Type**: `UptimeMonitorResponse`

```typescript
interface UptimeMonitorResponse {
  data: Monitor[];
  pagination: Pagination;
}

interface Monitor {
  id: string;
  type: 'monitor';
  attributes: MonitorAttributes;
  relationships: {
    policy: {
      data: null | unknown;
    };
  };
}
```

## Status Calculation Logic

The component calculates overall system health as follows:

```typescript
const upMonitors = data.filter((monitor) => monitor.attributes.status === 'up').length;
const totalMonitors = data.length;
const status = totalMonitors > 0 ? upMonitors / totalMonitors : 0;

if (status === 0) {
  // All monitors down - Red
  statusColor = 'bg-destructive';
  statusLabel = 'Degraded performance';
} else if (status < 1) {
  // Some monitors down - Orange
  statusColor = 'bg-orange-500';
  statusLabel = 'Partial outage';
} else {
  // All monitors up - Green
  statusColor = 'bg-green-500';
  statusLabel = 'All systems normal';
}
```

## Error Handling

The component implements robust error handling:

1. **Missing Configuration**: Returns `null` if environment variables are not set
2. **API Errors**: Catches and logs errors, displays "Unable to fetch status"
3. **Network Failures**: Gracefully degrades to gray indicator
4. **Invalid Responses**: Handles malformed API responses

Error Example:

```typescript
try {
  const response = await fetch(...);
  // Process response
} catch (error) {
  console.error('Error fetching BetterStack status:', error);
  statusColor = 'bg-muted-foreground';
  statusLabel = 'Unable to fetch status';
}
```

## Performance Considerations

1. **Caching**: 60-second cache reduces API calls
2. **Server-Side Rendering**: Component runs on server, no client-side JavaScript
3. **Minimal Bundle Size**: No client-side dependencies
4. **Efficient Calculation**: O(n) complexity for status calculation

## Monitoring and Debugging

### Check Status in Development

```bash
# Verify environment variables
echo $BETTERSTACK_API_KEY
echo $BETTERSTACK_URL

# Test API connection
curl -H "Authorization: Bearer $BETTERSTACK_API_KEY" \
  https://uptime.betterstack.com/api/v2/monitors
```

### Common Issues

#### Status Not Displaying

**Problem**: Component returns `null`

**Solution**:

1. Verify environment variables are set
2. Check that variables are not empty strings
3. Restart development server after adding env vars

#### "Unable to fetch status" Message

**Problem**: API request failing

**Solution**:

1. Verify API key is correct
2. Check API key has "Read Monitors" permission
3. Ensure network can reach BetterStack API
4. Check server logs for detailed error messages

#### Wrong Status Displayed

**Problem**: Status doesn't match actual system state

**Solution**:

1. Check cache duration (180 seconds)
2. Verify monitors are configured correctly in BetterStack
3. Review monitor status calculation logic

## Best Practices

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables
   - Rotate keys periodically

2. **Error Handling**
   - Always catch and log errors
   - Provide graceful degradation
   - Don't expose internal errors to users

3. **Performance**
   - Use appropriate cache duration
   - Monitor API usage
   - Consider rate limiting

4. **Monitoring**
   - Track API errors in monitoring system
   - Set up alerts for failures
   - Review logs regularly

## Testing

### Unit Tests

```typescript
import { Status } from '@/components/atoms/Status';
import { render, screen } from '@testing-library/react';

describe('Status Component', () => {
  it('displays "All systems normal" when all monitors are up', async () => {
    // Mock API response with all monitors up
    // Assert correct status and color
  });

  it('displays "Partial outage" when some monitors are down', async () => {
    // Mock API response with partial outage
    // Assert correct status and color
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    // Assert fallback status
  });
});
```

### Integration Tests

Test the Status component within the Footer to ensure proper integration.

## References

- [BetterStack Uptime Documentation](https://betterstack.com/docs/uptime)
- [BetterStack API Reference](https://betterstack.com/docs/uptime/api)
- [Status Component Source](../components/atoms/Status.tsx)
- [BetterStack Types](../types/betterstack.ts)
- [Configuration](../config/betterstack.ts)

## Future Enhancements

Potential improvements for the BetterStack integration:

1. **Detailed Status Modal**: Click to see individual monitor statuses
2. **Historical Data**: Show uptime percentage over time
3. **Incident Timeline**: Display recent incidents
4. **Webhook Integration**: Real-time updates via webhooks
5. **Custom Status Messages**: Override messages for specific situations
6. **Multi-Region Status**: Show status by geographic region
