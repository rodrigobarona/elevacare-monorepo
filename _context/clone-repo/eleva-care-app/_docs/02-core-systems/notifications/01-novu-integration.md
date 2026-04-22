# Novu Notifications Implementation

## Overview

Eleva Care App uses Novu for comprehensive notification management, providing real-time in-app notifications, email notifications, and notification history. This implementation follows the official Next.js best practices using the current supported packages.

## Architecture

### Core Components

1. **Configuration** (`config/novu.ts`)
   - Server-side Novu workflow definitions
   - Environment variable validation
   - Uses `@novu/framework` (v2.6.7) - ✅ **Current and supported**

2. **Notification System** (`lib/notifications.ts`)
   - Core notification creation function
   - Integration with Novu workflows
   - Type-safe notification handling

3. **Constants** (`lib/constants/notifications.ts`)
   - Centralized notification type definitions
   - UI constants (icons, colors)
   - Helper functions

4. **Frontend Components**
   - Next.js App Router notifications page
   - Uses `@novu/nextjs` for the Inbox component

### Key Files

- `config/novu.ts` - Server-side workflow definitions and API route setup
- `app/api/novu/route.ts` - Next.js API route for Novu framework
- `lib/notifications.ts` - Core notification functions
- `lib/constants/notifications.ts` - Centralized constants and types
- `app/(private)/account/notifications/page.tsx` - Main notifications UI
- `lib/payment-notifications.ts` - Payment-specific notifications

## Implementation Details

### Server-Side Setup

The server-side implementation uses the Novu Framework SDK for defining and serving workflows:

```typescript
// config/novu.ts
import { workflow } from '@novu/framework';
import { serve } from '@novu/framework/next';
import { z } from 'zod';

// Define notification workflows
export const welcomeWorkflow = workflow(
  'user-welcome',
  async ({ payload, step }) => {
    await step.inApp('welcome-message', async () => ({
      subject: `Welcome to Eleva Care, ${payload.userName}!`,
      body: `Hi ${payload.userName}! Welcome to Eleva Care.`,
    }));
  },
  {
    payloadSchema: z.object({
      userName: z.string(),
    }),
  },
);

// Serve workflows for Next.js API routes
export const { GET, POST, OPTIONS } = serve({
  workflows: [welcomeWorkflow],
  apiKey: process.env.NOVU_SECRET_KEY,
});
```

### Next.js API Route

The framework requires a Next.js API route to serve the workflows:

```typescript
// app/api/novu/route.ts
import { GET, OPTIONS, POST } from '@/config/novu';

export { GET, POST, OPTIONS };
```

### Next.js Inbox Component

Following the official Novu Next.js quickstart guide, the frontend uses `@novu/nextjs`:

```tsx
// app/(private)/account/notifications/page.tsx
import { Inbox } from '@novu/nextjs';

export default function NotificationsPage() {
  const { user, isLoaded } = useUser();

  return (
    <Inbox
      applicationIdentifier={ENV_CONFIG.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER}
      subscriber={user.id}
      backendUrl="https://eu.api.novu.co"
      socketUrl="https://eu.ws.novu.co"
    />
  );
}
```

### Notification Types and Constants

All notification types and UI constants are centralized in `lib/constants/notifications.ts`:

```typescript
// Notification types
export const NOTIFICATION_TYPE_VERIFICATION_HELP = 'VERIFICATION_HELP' as const;
export const NOTIFICATION_TYPE_ACCOUNT_UPDATE = 'ACCOUNT_UPDATE' as const;
export const NOTIFICATION_TYPE_SECURITY_ALERT = 'SECURITY_ALERT' as const;
export const NOTIFICATION_TYPE_SYSTEM_MESSAGE = 'SYSTEM_MESSAGE' as const;

// UI constants
export const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPE_VERIFICATION_HELP]: '🔍',
  [NOTIFICATION_TYPE_ACCOUNT_UPDATE]: '👤',
  [NOTIFICATION_TYPE_SECURITY_ALERT]: '🔒',
  [NOTIFICATION_TYPE_SYSTEM_MESSAGE]: '📢',
} as const;
```

### Creating Notifications

Use the centralized `createUserNotification` function with workflow triggers:

```typescript
import { NOTIFICATION_TYPE_ACCOUNT_UPDATE } from '@/lib/constants/notifications';
import { createUserNotification } from '@/lib/notifications';

await createUserNotification({
  userId: user.id,
  type: NOTIFICATION_TYPE_ACCOUNT_UPDATE,
  data: {
    userName: user.firstName,
    message: 'Your account has been updated successfully.',
  },
});
```

## Environment Variables

### Required Variables

```env
# Novu Configuration
NOVU_SECRET_KEY=your_novu_secret_key
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_application_identifier
```

### Optional Variables

```env
# Custom Novu endpoints (defaults to EU region)
NEXT_PUBLIC_NOVU_BACKEND_URL=https://eu.api.novu.co
NEXT_PUBLIC_NOVU_SOCKET_URL=https://eu.ws.novu.co
```

## Notification Workflows

### Active Workflows

1. **Welcome Notification** (`user-welcome`)
   - Triggered on user registration
   - Provides onboarding information

2. **Account Verification** (`account-verification`)
   - Sent when user needs to verify email
   - Contains verification link

3. **Payment Notifications**
   - Success: `payment-success`
   - Failed: `payment-failed`

4. **Security Notifications**
   - Password reset: `password-reset`
   - Security alert: `security-alert`

### Creating New Workflows

1. **Define in Configuration**

   ```typescript
   // config/novu.ts
   export const newWorkflow = workflow(
     'new-workflow-id',
     async ({ payload, step }) => {
       await step.inApp('notification-step', async () => ({
         subject: 'New Notification',
         body: `Hello ${payload.userName}!`,
       }));
     },
     {
       payloadSchema: z.object({
         userName: z.string(),
       }),
     },
   );
   ```

2. **Add to Workflows Array**

   ```typescript
   export const workflows = [
     // ... existing workflows
     newWorkflow,
   ];
   ```

3. **Use in Code**
   ```typescript
   await createUserNotification({
     userId: user.id,
     type: NOTIFICATION_TYPE_SYSTEM_MESSAGE,
     data: {
       message: 'Your custom notification message',
     },
   });
   ```

## Integration Points

### Stripe Webhooks

- `app/api/webhooks/stripe/route.ts` - Handles payment events
- Automatically creates payment notifications

### User Registration

- Welcome notifications sent via Clerk webhooks
- Account verification reminders

### Account Management

- Security alerts for profile changes
- System notifications for important updates

## Features

### Real-time Notifications

- WebSocket connection for instant delivery
- Automatic UI updates
- Read/unread status tracking

### Notification History

- Complete notification history
- Search and filtering capabilities
- Archive functionality

### Email Integration

- Automatic email notifications
- Customizable templates
- HTML and text versions

## Security

### HMAC Authentication

For production environments, enable HMAC authentication:

```typescript
// Generate hash on server
import { createHmac } from 'crypto';
const subscriberHash = createHmac('sha256', process.env.NOVU_SECRET_KEY)
  .update(subscriberId)
  .digest('hex');

// Use in component
<Inbox
  applicationIdentifier={applicationIdentifier}
  subscriber={subscriberId}
  subscriberHash={subscriberHash}
/>
```

## Migration Status ✅ **COMPLETE**

### Current Packages (May 2025)

- `@novu/framework@2.6.7` - ✅ **Current and supported** (Server-side workflows)
- `@novu/nextjs@3.5.0` - ✅ **Current and supported** (Frontend Inbox)

### Migration Completed

The migration from deprecated packages has been completed successfully:

- ✅ **Migrated from** `@novu/node@2.6.6` (deprecated) **to** `@novu/framework@2.6.7`
- ✅ **Removed** `@novu/headless@2.6.6` (no longer needed)
- ✅ **Updated** all notification workflows to use the new framework
- ✅ **Migrated** API integration from `novu.trigger()` to workflow triggers

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check environment variables
   - Verify user is properly subscribed
   - Check browser console for errors
   - Ensure `/api/webhooks/novu` endpoint is accessible

2. **WebSocket connection issues**
   - Verify `socketUrl` configuration
   - Check network/firewall settings

3. **Workflow not triggering**
   - Verify workflow exists in configuration
   - Check API key permissions
   - Verify workflow is included in the workflows array
   - Check the `/api/webhooks/novu` endpoint logs

### Debug Mode

Enable debug logging:

```typescript
// Add to notification creation
console.log('Creating notification:', {
  userId,
  type,
  data,
});
```

## Performance Considerations

### Optimization Strategies

- Batch notification creation when possible
- Use appropriate notification priorities
- Implement notification rate limiting
- Cache notification preferences

### Monitoring

- Track notification delivery rates
- Monitor API response times
- Set up error alerting

## Related Documentation

- [Notification Workflows Guide](./notification_workflows_guide.md) - Business workflow documentation
- [Novu Official Docs](https://docs.novu.co/) - Official Novu documentation
- [Next.js Integration](https://docs.novu.co/quickstart/nextjs) - Novu Next.js quickstart
- [Novu Framework](https://docs.novu.co/framework) - Novu Framework documentation
