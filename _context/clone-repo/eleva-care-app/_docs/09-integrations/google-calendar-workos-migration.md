# Google Calendar Integration - WorkOS OAuth Migration Guide

## 🎯 Overview

This guide explains how to migrate Google Calendar integration from Clerk to **WorkOS OAuth with database token storage**.

### Architecture

```
┌─────────────┐       ┌──────────┐       ┌────────────┐       ┌──────────────┐
│   Expert    │──────>│  WorkOS  │──────>│   Google   │──────>│   Database   │
│   (User)    │       │   OAuth  │       │   OAuth    │       │   (Tokens)   │
└─────────────┘       └──────────┘       └────────────┘       └──────────────┘
       │                     │                    │                      │
       │  1. Connect         │                    │                      │
       │     Calendar        │                    │                      │
       │────────────────────>│                    │                      │
       │                     │  2. Redirect to    │                      │
       │                     │     Google         │                      │
       │                     │───────────────────>│                      │
       │                     │                    │  3. User Authorizes  │
       │                     │                    │<─────────────────────│
       │                     │  4. Return tokens  │                      │
       │                     │<───────────────────│                      │
       │                     │  5. Store tokens   │                      │
       │                     │───────────────────────────────────────────>│
       │  6. Access          │                    │                      │
       │     Calendar API    │                    │                      │
       │────────────────────────────────────────────────────────────────>│
       │                     │                    │  7. Auto-refresh     │
       │                     │                    │<─────────────────────│
```

### Benefits

✅ **WorkOS Native** - Uses WorkOS OAuth infrastructure  
✅ **Database Storage** - Full control over token management  
✅ **Auto-Refresh** - Google Auth Library handles token refresh  
✅ **Secure** - Tokens can be encrypted at rest  
✅ **Auditable** - All token operations logged  
✅ **Scalable** - No external service dependencies

---

## 📋 Migration Steps

### Step 1: WorkOS Dashboard Configuration

#### 1.1 Enable Google OAuth Provider

1. Go to [WorkOS Dashboard](https://dashboard.workos.com) → **Authentication** → **Social Providers**
2. Enable **Google OAuth**
3. Configure:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console
   - **Return OAuth tokens**: ✅ **ENABLE THIS**

#### 1.2 Configure OAuth Scopes

Add these scopes in WorkOS Dashboard:

```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

#### 1.3 Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create/Edit OAuth 2.0 Client ID
3. Add Authorized Redirect URIs:
   ```
   https://api.workos.com/sso/oauth/google/callback
   http://localhost:3000/api/auth/google/callback (dev)
   https://eleva.care/api/auth/google/callback (prod)
   ```

---

### Step 2: Database Migration

Run the migration to add Google OAuth columns:

```bash
cd /Users/rodrigo.barona/Documents/GitHub/eleva-care-app
psql $DATABASE_URL -f drizzle/migrations-manual/012_add_google_oauth_columns.sql
```

**Columns added:**
- `google_access_token` - Short-lived access token
- `google_refresh_token` - Long-lived refresh token (SENSITIVE)
- `google_token_expiry` - Token expiration timestamp
- `google_calendar_connected` - Quick boolean check
- `google_calendar_connected_at` - Connection timestamp

---

### Step 3: Environment Variables

Add to `.env.local` and production:

```bash
# Google OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Production
GOOGLE_OAUTH_REDIRECT_URI=https://eleva.care/api/auth/google/callback
```

---

### Step 4: Implementation Files

#### 4.1 Token Management Service ✅ 

**File:** `lib/integrations/google/oauth-tokens.ts`

This file provides:
- `storeGoogleTokens()` - Save tokens from OAuth callback
- `getGoogleOAuthClient()` - Get authenticated client with auto-refresh
- `hasGoogleCalendarConnected()` - Check connection status
- `disconnectGoogleCalendar()` - Revoke and remove tokens

#### 4.2 OAuth Callback Route (NEW)

Create `app/api/auth/google/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { WorkOS } from '@workos-inc/node';
import { storeGoogleTokens } from '@/lib/integrations/google/oauth-tokens';
import { withAuth } from '@workos-inc/authkit-nextjs';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

/**
 * Google OAuth callback route (via WorkOS)
 * 
 * Handles the OAuth flow completion and stores tokens
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Exchange code for tokens using WorkOS
    // Note: WorkOS SDK method depends on your setup
    // You may need to use WorkOS User Management API
    
    // For now, redirect to success page
    // WorkOS will provide tokens in the authentication response
    // You'll need to extract them based on your WorkOS configuration
    
    return NextResponse.redirect(new URL('/booking/setup?google=connected', request.url));
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/booking/setup?google=error', request.url)
    );
  }
}
```

#### 4.3 Connect Calendar Action (NEW)

Create `app/server/actions/google-calendar.ts`:

```typescript
'use server';

import { withAuth } from '@workos-inc/authkit-nextjs';
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

/**
 * Initiate Google Calendar connection via WorkOS OAuth
 * 
 * @returns Authorization URL to redirect user to
 */
export async function connectGoogleCalendar(): Promise<string> {
  const { user } = await withAuth();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Generate WorkOS authorization URL with Google OAuth provider
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'GoogleOAuth',
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    state: user.id, // Pass user ID in state for callback
    providerScopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });

  return authorizationUrl;
}
```

#### 4.4 Updated Google Calendar Service

Update `server/googleCalendar.ts` to use the new token system:

```typescript
import { getGoogleOAuthClient } from '@/lib/integrations/google/oauth-tokens';
import { google } from 'googleapis';

/**
 * Get calendar events for a user
 * 
 * Now uses database-stored tokens via WorkOS OAuth
 */
export async function getCalendarEventTimes(
  workosUserId: string,
  { start, end }: { start: Date; end: Date }
) {
  // Get authenticated client (handles token refresh automatically)
  const auth = await getGoogleOAuthClient(workosUserId);

  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

/**
 * Create calendar event with Google Meet
 */
export async function createCalendarEvent({
  workosUserId,
  summary,
  description,
  start,
  end,
  attendees,
}: {
  workosUserId: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: Array<{ email: string; displayName?: string }>;
}) {
  const auth = await getGoogleOAuthClient(workosUserId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    },
  });

  return response.data;
}
```

---

### Step 5: UI Components

#### Connect Calendar Button

```typescript
'use client';

import { useState } from 'react';
import { connectGoogleCalendar } from '@/server/actions/google-calendar';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

export function ConnectGoogleCalendarButton() {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    try {
      setLoading(true);
      const authUrl = await connectGoogleCalendar();
      window.location.href = authUrl; // Redirect to WorkOS OAuth
    } catch (error) {
      console.error('Failed to connect calendar:', error);
      alert('Failed to connect calendar. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleConnect} disabled={loading}>
      <Calendar className="mr-2 h-4 w-4" />
      {loading ? 'Connecting...' : 'Connect Google Calendar'}
    </Button>
  );
}
```

---

## 🔒 Security Best Practices

### 1. Token Encryption (Production)

Encrypt tokens at rest in production:

```typescript
// lib/crypto/tokens.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```bash
TOKEN_ENCRYPTION_KEY=your-64-character-hex-key
```

### 2. Token Access Control

- ✅ Never expose tokens in API responses
- ✅ Use server actions for all Google API calls
- ✅ Validate user owns the tokens before use
- ✅ Log all token access for auditing

### 3. Token Revocation

Implement token revocation on:
- Account deletion
- User requests
- Security incidents
- Periodic rotation

---

## 📊 Migration Checklist

### Pre-Migration

- [ ] WorkOS Dashboard: Enable Google OAuth
- [ ] WorkOS Dashboard: Configure "Return OAuth tokens"
- [ ] WorkOS Dashboard: Add required scopes
- [ ] Google Cloud Console: Update redirect URIs
- [ ] Environment variables configured
- [ ] Database migration applied

### Implementation

- [ ] Token management service created (`oauth-tokens.ts`)
- [ ] OAuth callback route implemented
- [ ] Connect calendar action created
- [ ] Google Calendar service updated
- [ ] UI components added
- [ ] Token encryption implemented (production)

### Testing

- [ ] OAuth flow works (dev environment)
- [ ] Tokens stored correctly in database
- [ ] Token refresh works automatically
- [ ] Calendar events can be fetched
- [ ] Calendar events can be created
- [ ] Disconnect works and revokes tokens
- [ ] Error handling tested

### Production

- [ ] All environment variables set
- [ ] Token encryption enabled
- [ ] WorkOS production environment configured
- [ ] Google OAuth production credentials set
- [ ] Monitoring and logging configured
- [ ] Backup and recovery plan documented

---

## 🔧 Troubleshooting

### "No OAuth token found"

**Cause:** WorkOS not configured to return OAuth tokens  
**Fix:** Enable "Return OAuth tokens" in WorkOS Dashboard

### "Invalid grant" error

**Cause:** Refresh token expired or revoked  
**Fix:** User must re-authorize via OAuth flow

### "Insufficient permissions"

**Cause:** Missing scopes in WorkOS configuration  
**Fix:** Add required scopes in WorkOS Dashboard

### Tokens not refreshing

**Cause:** Missing refresh token in database  
**Fix:** User must re-authorize (refresh tokens only provided on first auth)

---

## 📚 Resources

- [WorkOS OAuth Documentation](https://workos.com/docs/integrations/google-oauth)
- [Google Auth Library Node.js](https://github.com/googleapis/google-auth-library-nodejs)
- [Google Calendar API](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

## 🚀 Next Steps

1. **Run database migration**
2. **Configure WorkOS Dashboard**
3. **Implement OAuth callback route**
4. **Update Google Calendar service**
5. **Test in development**
6. **Deploy to production**
7. **Monitor and optimize**

---

**Status:** Ready for implementation  
**Estimated Time:** 4-6 hours  
**Complexity:** Medium  
**Dependencies:** WorkOS, Google Cloud Console access

