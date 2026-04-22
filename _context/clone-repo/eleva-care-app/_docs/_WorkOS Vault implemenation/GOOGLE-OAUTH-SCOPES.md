# Google OAuth Scopes Configuration

**Environment:** WorkOS OAuth + Google Calendar Integration  
**Date:** January 2025

---

## 🎯 Overview

This document explains how Google OAuth scopes are configured when using WorkOS OAuth provider with Google Calendar integration.

---

## 📋 Scope Configuration

### WorkOS OAuth Provider Configuration

When configuring the Google OAuth connection in WorkOS Dashboard, you should request these scopes:

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

**Note:** These narrow scopes avoid Google OAuth verification requirements!

### Scope Breakdown:

| Scope                                                            | Purpose                                                        | Handled By            | Privilege Level | Required For                |
| ---------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- | --------------- | --------------------------- |
| `openid`                                                         | OpenID Connect authentication                                  | WorkOS OAuth Provider | Standard        | Authentication              |
| `https://www.googleapis.com/auth/userinfo.email`                 | User's email address                                           | WorkOS OAuth Provider | Standard        | Authentication              |
| `https://www.googleapis.com/auth/userinfo.profile`               | User's basic profile                                           | WorkOS OAuth Provider | Standard        | Authentication              |
| `https://www.googleapis.com/auth/calendar.events`                | **Create, edit, delete events** ✅                             | Your Application      | Narrow ✅       | Event CRUD operations       |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | **List user's calendars** ✅                                   | Your Application      | Narrow ✅       | Let expert choose calendars |
| `https://www.googleapis.com/auth/calendar`                       | Full access (share, delete calendars) - ❌ **NOT RECOMMENDED** | N/A                   | Broad ⚠️        | NOT NEEDED                  |

**Why These Scopes?**

1. ✅ **`calendar.events`** - Create/edit/delete events (exactly what you need)
2. ✅ **`calendar.calendarlist.readonly`** - List calendars (Cal.com-style selection)
3. ❌ **NOT `calendar`** - Too broad, triggers Google OAuth verification

**Use Cases Covered:**

| Feature                           | Scope Needed                      | Status |
| --------------------------------- | --------------------------------- | ------ |
| Create appointment events         | `calendar.events`                 | ✅     |
| Edit/reschedule events            | `calendar.events`                 | ✅     |
| Delete events                     | `calendar.events`                 | ✅     |
| List user's calendars             | `calendar.calendarlist.readonly`  | ✅     |
| Let expert choose which calendars | `calendar.calendarlist.readonly`  | ✅     |
| Check availability (free/busy)    | `calendar.events`                 | ✅     |
| Share calendars                   | `calendar` (full) - ❌ Not needed | ❌     |
| Delete calendars                  | `calendar` (full) - ❌ Not needed | ❌     |

**Google OAuth Verification:**

- ✅ **With narrow scopes** - Likely NO verification required
- ⚠️ **With full `calendar` scope** - REQUIRES verification process

---

## ✅ Fixed Implementation

### What Was Wrong:

```typescript
// ❌ WRONG - Multiple issues
scope: 'https://www.googleapis.com/auth/calendar, https://www.googleapis.com/auth/calendar/events';
```

**Issues:**

1. ❌ Using comma + space separator (Google expects space-only)
2. ❌ Using `/events` instead of `.events` (wrong path separator)
3. ❌ Hardcoded scopes (not storing actual granted scopes)

### What's Correct Now:

```typescript
// ✅ CORRECT - Narrow scopes that avoid OAuth verification
scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';

// ⚠️ WRONG - Too broad, triggers Google OAuth verification
scope: 'https://www.googleapis.com/auth/calendar';
```

**Why Two Scopes?**

1. **`calendar.events`** - Create/edit/delete events on ANY calendar
2. **`calendar.calendarlist.readonly`** - List calendars (so expert can choose which ones to sync)

**Recommendation:** Use these two narrow scopes unless you need to:

- ❌ Share/unshare calendars (you don't)
- ❌ Permanently delete calendars (you don't)
- ❌ Modify calendar properties (you don't)

**Cal.com Pattern:**

This is exactly what Cal.com uses:

1. List user's calendars (`calendarlist.readonly`)
2. Let user toggle which calendars to check for conflicts
3. Create events in selected calendar (`calendar.events`)

---

## 🏗️ Architecture Changes

### Database Schema Update

Added `googleScopes` column to store actual granted scopes:

```typescript
// drizzle/schema-workos.ts
UsersTable: {
  // ... other fields ...
  googleScopes: text('google_scopes'), // Granted OAuth scopes (space-separated string)
}
```

### Token Storage (Now Stores Actual Scopes)

```typescript
// Store actual scopes from OAuth response
await storeGoogleTokens(workosUserId, {
  access_token: 'ya29...',
  refresh_token: '1//...',
  expiry_date: Date.now() + 3600000,
  token_type: 'Bearer',
  scope: 'openid https://www.googleapis.com/auth/userinfo.email ...', // Actual granted scopes
});
```

### Token Retrieval (Returns Stored Scopes)

```typescript
const tokens = await getStoredGoogleTokens(workosUserId);

// Returns actual scopes from database, or fallback to default
console.log(tokens.scope);
// Output: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"
```

---

## 🔄 Scope Management Flow

### 1. Initial OAuth Flow (WorkOS)

```
User clicks "Connect Google Calendar"
  ↓
Redirect to WorkOS OAuth endpoint
  ↓
WorkOS redirects to Google with requested scopes
  ↓
User grants permissions
  ↓
Google returns tokens with granted scopes
  ↓
WorkOS OAuth callback receives tokens
  ↓
Your app stores tokens + scopes in database (encrypted)
```

### 2. Token Storage

```typescript
// app/api/auth/google/callback/route.ts
export async function GET(request: Request) {
  // Get tokens from WorkOS OAuth callback
  const tokens = await workos.oauth.getToken(code);

  // Store with actual granted scopes
  await storeGoogleTokens(userId, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_in * 1000 + Date.now(),
    token_type: 'Bearer',
    scope: tokens.scope, // ✅ Store actual granted scopes
  });
}
```

### 3. Token Refresh (Automatic)

```typescript
// Automatic refresh handler in oauth-tokens.ts
oauth2Client.on('tokens', async (newTokens) => {
  // Update tokens + scopes if changed
  await db.update(UsersTable).set({
    vaultGoogleAccessToken: encrypted.ciphertext,
    googleTokenExpiry: new Date(newTokens.expiry_date),
    googleScopes: newTokens.scope, // ✅ Update scopes if changed
  });
});
```

---

## 📊 Scope Format Specification

### Google OAuth Scope Format:

- **Separator:** Space (` `)
- **NOT:** Comma (`,`) or comma+space (`, `)
- **Case-sensitive:** Must match exactly
- **Path separator:** Dot (`.`) for sub-scopes, NOT slash (`/`)

### Examples:

```typescript
// ✅ CORRECT
'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

// ❌ WRONG - comma separator
'https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events';

// ❌ WRONG - comma + space separator
'https://www.googleapis.com/auth/calendar, https://www.googleapis.com/auth/calendar.events';

// ❌ WRONG - slash instead of dot
'https://www.googleapis.com/auth/calendar/events';
```

---

## 🧪 Testing

### Verify Stored Scopes:

```sql
-- Check what scopes are stored
SELECT
  workos_user_id,
  google_scopes,
  google_calendar_connected,
  google_calendar_connected_at
FROM users
WHERE google_calendar_connected = true;
```

### Verify Token Scopes in Code:

```typescript
const tokens = await getStoredGoogleTokens(userId);
console.log('Granted scopes:', tokens?.scope);

// Expected output (may vary based on what user granted):
// "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events"
```

---

## 🔒 Security Considerations

### Scope Validation:

Before using Google Calendar API, verify required scopes are present:

```typescript
export function hasCalendarScopes(tokens: GoogleOAuthTokens): boolean {
  // Check for either calendar.events (preferred) OR full calendar scope
  const hasEvents = tokens.scope.includes('https://www.googleapis.com/auth/calendar.events');
  const hasFull = tokens.scope.includes('https://www.googleapis.com/auth/calendar');

  return hasEvents || hasFull;
}

// Usage
const tokens = await getStoredGoogleTokens(userId);
if (!tokens || !hasCalendarScopes(tokens)) {
  throw new Error('Missing required Google Calendar permissions');
}
```

### Handling Scope Changes:

If Google or WorkOS changes the granted scopes:

1. **Automatic:** Scopes updated on token refresh
2. **Manual:** User must re-authorize via WorkOS OAuth
3. **Fallback:** Default scopes used if `googleScopes` is null

---

## 📚 Reference Documentation

### Google OAuth Scopes:

- **Calendar API:** https://developers.google.com/calendar/api/guides/auth
- **OAuth 2.0 Scopes:** https://developers.google.com/identity/protocols/oauth2/scopes

### WorkOS OAuth:

- **OAuth Guide:** https://workos.com/docs/user-management/oauth
- **Google Provider:** https://workos.com/docs/user-management/oauth/google

---

## 🎯 Migration Checklist

If you're updating from hardcoded scopes:

- [ ] Add `googleScopes` column to database schema
- [ ] Update `storeGoogleTokens()` to save actual scopes
- [ ] Update `getStoredGoogleTokens()` to return stored scopes
- [ ] Update token refresh handler to update scopes
- [ ] Update disconnect function to clear scopes
- [ ] Run database migration: `pnpm drizzle:push`
- [ ] Test OAuth flow end-to-end
- [ ] Verify scopes are stored correctly in database

---

## ✅ Summary

**What Changed:**

1. ✅ Fixed scope format (space-separated, not comma-separated)
2. ✅ Fixed scope path (`.events` not `/events`)
3. ✅ Added `googleScopes` database column
4. ✅ Store actual granted scopes from OAuth response
5. ✅ Return stored scopes when retrieving tokens
6. ✅ Update scopes on token refresh
7. ✅ Fallback to default scopes if none stored

**Benefits:**

- ✅ Accurate scope tracking
- ✅ Supports scope changes over time
- ✅ Better debugging (see what user actually granted)
- ✅ Future-proof (handles new scopes automatically)
- ✅ Correct OAuth implementation

---

**Your Google OAuth scopes are now properly configured!** 🎉
