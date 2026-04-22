# BotID Implementation Guide

## Overview

This document outlines the implementation of Vercel BotID protection across the Eleva Care application. BotID provides invisible CAPTCHA protection against sophisticated bots without showing visible challenges or requiring manual intervention.

## Architecture

### Client-Side Protection

BotID protection is initialized in `instrumentation-client.ts` using the recommended Next.js 15.3+ approach:

```typescript
import { initBotId } from 'botid/client/core';

initBotId({
  protect: [
    {
      path: '/api/create-payment-intent',
      method: 'POST',
      advancedOptions: {
        checkLevel: 'deepAnalysis',
      },
    },
    // ... other protected routes
  ],
});
```

### Server-Side Verification

Protected endpoints use the `checkBotId()` function to verify requests:

```typescript
import { checkBotId } from 'botid/server';

const botVerification = await checkBotId({
  advancedOptions: {
    checkLevel: 'deepAnalysis', // or 'basic'
  },
});

if (botVerification.isBot) {
  // Handle bot detection
  return NextResponse.json(
    { error: 'Access denied' },
    { status: 403 }
  );
}
```

## Protected Routes

### High Priority (Deep Analysis)

These routes use `deepAnalysis` mode for maximum protection:

1. **`/api/create-payment-intent`** - Payment processing
2. **`/api/upload`** - File uploads
3. **Server Action: `createMeeting`** - Meeting creation
4. **Booking flows** - `/*/booking` and `/*/booking/*`

### Medium Priority (Basic Protection)

These routes use `basic` mode for standard protection:

1. **`/api/admin/*`** - Administrative operations
2. **Server Action: `createEvent`** - Event creation
3. **Profile management** - `/account`, `/setup`
4. **Billing operations** - `/api/user/billing`

## Implementation Details

### 1. Payment Protection

The payment intent creation endpoint includes comprehensive bot protection:

```typescript
// app/api/create-payment-intent/route.ts
const botVerification = await checkBotId({
  advancedOptions: {
    checkLevel: 'deepAnalysis',
  },
});

if (botVerification.isBot) {
  // Allow specific verified monitoring bots
  const allowedVerifiedBots = ['pingdom-bot', 'uptime-robot', 'checkly'];
  const isAllowedBot = botVerification.isVerifiedBot &&
    allowedVerifiedBots.includes(botVerification.verifiedBotName || '');

  if (!isAllowedBot) {
    return NextResponse.json(
      {
        error: 'Access denied',
        message: 'Automated requests are not allowed for payment processing'
      },
      { status: 403 }
    );
  }
}
```

### 2. Server Actions Protection

Server actions include bot protection at the beginning of each function:

```typescript
// server/actions/meetings.ts
export async function createMeeting(unsafeData: z.infer<typeof meetingActionSchema>) {
  const botVerification = await checkBotId({
    advancedOptions: {
      checkLevel: 'deepAnalysis',
    },
  });

  if (botVerification.isBot) {
    return {
      error: true,
      code: 'BOT_DETECTED',
      message: 'Automated meeting creation is not allowed',
    };
  }

  // ... rest of function
}
```

### 3. Form Error Handling

Forms handle BotID responses gracefully:

```typescript
// components/organisms/forms/MeetingForm.tsx
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));

  // Handle BotID protection responses
  if (response.status === 403 && errorData.error === 'Access denied') {
    throw new Error(errorData.message || 'Request blocked for security reasons');
  }

  throw new Error(errorData.error || 'Failed to create payment intent');
}
```

## Configuration

### Next.js Configuration

BotID is integrated into the Next.js configuration:

```typescript
// next.config.ts
import { withBotId } from 'botid/next/config';

export default withBotId(withBundleAnalyzer(withNextIntl(nextConfig)));
```

### Protection Levels

- **Deep Analysis**: Used for critical operations (payments, bookings)
  - Provides maximum protection against sophisticated bots
  - Costs $1/1000 `checkBotId()` calls
  - Recommended for high-value transactions

- **Basic**: Used for general form submissions
  - Ensures valid browser sessions
  - Free on all Vercel plans
  - Suitable for user registration and profile updates

## Verified Bots

The implementation handles verified bots appropriately:

- **Monitoring Services**: Pingdom, Uptime Robot, Checkly are allowed for payment endpoints
- **Search Engines**: Automatically allowed by BotID
- **AI Assistants**: Can be configured per endpoint needs

## Testing

### Local Development

BotID always returns `{ isBot: false }` in development mode. To test bot detection:

```typescript
const verification = await checkBotId({
  developmentOptions: {
    bypass: 'BAD-BOT', // Simulates bot detection
  },
});
```

### Production Testing

- Use browser-based requests for testing protected endpoints
- `curl` requests will be blocked in production
- Monitor BotID traffic in Vercel Dashboard → Firewall tab

## Monitoring

### Vercel Dashboard

1. Navigate to Project → Firewall tab
2. Select "BotID" in traffic dropdown filter
3. Monitor blocked requests and patterns

### Logging

All bot detections are logged with context:

```typescript
console.warn('🚫 Bot detected in payment intent creation:', {
  isVerifiedBot: botVerification.isVerifiedBot,
  verifiedBotName: botVerification.verifiedBotName,
  verifiedBotCategory: botVerification.verifiedBotCategory,
});
```

## Best Practices

1. **Consistent Protection**: Ensure client and server configurations match
2. **Error Handling**: Provide user-friendly error messages
3. **Verified Bots**: Allow legitimate monitoring and search bots
4. **Performance**: Use appropriate protection levels for each endpoint
5. **Monitoring**: Regularly review blocked traffic patterns

## Troubleshooting

### Common Issues

1. **Verification Failures**: Ensure client-side protection is configured for the route
2. **Legitimate Traffic Blocked**: Check if verified bots need to be allowed
3. **Performance Impact**: Consider using 'basic' mode for non-critical endpoints

### Debug Steps

1. Check browser console for BotID client errors
2. Verify server logs for bot detection messages
3. Review Vercel Dashboard firewall traffic
4. Test with different browsers and devices

## Future Enhancements

1. **Dynamic Protection**: Adjust protection levels based on threat patterns
2. **Custom Rules**: Implement custom bot detection logic
3. **Analytics Integration**: Track bot attempts in PostHog
4. **Rate Limiting**: Combine with existing rate limiting for enhanced protection

## References

- [Vercel BotID Documentation](https://vercel.com/docs/botid)
- [BotID Get Started Guide](https://vercel.com/docs/botid/get-started)
- [Bot Management Overview](https://vercel.com/docs/bot-management)
