# Google Calendar Integration - Migration Summary

## ✅ Completed

### 1. **Schema Updates**
- ✅ Added Google OAuth columns to `UsersTable`:
  - `googleAccessToken` - Access token for API calls
  - `googleRefreshToken` - Long-lived refresh token
  - `googleTokenExpiry` - Token expiration timestamp
  - `googleCalendarConnected` - Quick boolean check
  - `googleCalendarConnectedAt` - First connection timestamp
- ✅ Created SQL migration: `drizzle/migrations-manual/012_add_google_oauth_columns.sql`
- ✅ Updated `drizzle/schema-workos.ts` with proper types and comments

### 2. **Token Management Service**
- ✅ Created `lib/integrations/google/oauth-tokens.ts`
- ✅ Implements best practices from Google Auth Library:
  - Automatic token refresh with event handlers
  - Database storage with update on refresh
  - Secure credential management
  - Token revocation support

### 3. **Documentation**
- ✅ Comprehensive migration guide: `docs/09-integrations/google-calendar-workos-migration.md`
- ✅ Includes:
  - WorkOS Dashboard configuration steps
  - Google Cloud Console setup
  - Complete code examples
  - Security best practices
  - Troubleshooting guide
  - Migration checklist

---

## 🔨 What You Need to Do

### Step 1: Run Database Migration

```bash
cd /Users/rodrigo.barona/Documents/GitHub/eleva-care-app
psql $DATABASE_URL -f drizzle/migrations-manual/012_add_google_oauth_columns.sql
```

### Step 2: Configure WorkOS Dashboard

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **Authentication** → **Social Providers**
3. Enable **Google OAuth**
4. ⚠️ **IMPORTANT**: Enable "Return OAuth tokens" checkbox
5. Add OAuth scopes:
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```

### Step 3: Update Environment Variables

Add to `.env.local`:

```bash
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Step 4: Implement OAuth Routes

You need to create these files:

1. **OAuth Callback Route**: `app/api/auth/google/callback/route.ts`
   - Handles OAuth callback from WorkOS
   - Extracts tokens from WorkOS response
   - Calls `storeGoogleTokens()` to save to database

2. **Connect Calendar Action**: `server/actions/google-calendar.ts`
   - Server action to initiate OAuth flow
   - Returns WorkOS authorization URL
   - Client redirects to this URL

3. **UI Component**: `components/features/calendar/ConnectCalendarButton.tsx`
   - Button to trigger OAuth flow
   - Shows connection status

### Step 5: Update `server/googleCalendar.ts`

Replace all Clerk-based authentication with:

```typescript
import { getGoogleOAuthClient } from '@/lib/integrations/google/oauth-tokens';

// Then use it like:
const auth = await getGoogleOAuthClient(workosUserId);
const calendar = google.calendar({ version: 'v3', auth });
```

The token refresh happens automatically! No need to manually manage token expiry.

---

## 🏗️ Architecture Overview

```
WorkOS OAuth (Google Provider)
         ↓
   User Authorizes
         ↓
   Tokens Returned
         ↓
Database Storage (users table)
         ↓
Google Auth Library (auto-refresh)
         ↓
 Google Calendar API
```

### Key Benefits

✅ **No Clerk Dependency** - Fully WorkOS native  
✅ **Automatic Token Refresh** - Google Auth Library handles it  
✅ **Database Control** - Full visibility into tokens  
✅ **Secure** - Supports encryption at rest  
✅ **Scalable** - No external service limits  

---

## 📝 Implementation Notes

### Why Database Storage?

1. **Full Control**: You own the tokens, not a third party
2. **Auditing**: Can track token usage and refresh
3. **Flexibility**: Can implement custom refresh logic if needed
4. **Cost**: No additional service fees
5. **Privacy**: Tokens never leave your infrastructure

### Why WorkOS OAuth?

1. **Unified Auth**: Same system for user auth and OAuth
2. **Compliance**: WorkOS handles OAuth security best practices
3. **Simplicity**: No need to implement OAuth flow yourself
4. **Monitoring**: WorkOS Dashboard shows OAuth usage

---

## 🔒 Security Checklist

Before going to production:

- [ ] Add `TOKEN_ENCRYPTION_KEY` to environment variables
- [ ] Implement token encryption (see migration guide)
- [ ] Review WorkOS OAuth settings in Dashboard
- [ ] Set up monitoring for failed OAuth attempts
- [ ] Document token revocation procedures
- [ ] Test OAuth flow in staging environment
- [ ] Verify Google Cloud Console redirect URIs are correct
- [ ] Enable logging for all token operations

---

## 🧪 Testing Plan

1. **OAuth Flow**
   - [ ] User can click "Connect Calendar"
   - [ ] Redirected to Google consent screen
   - [ ] Returns to app with success message
   - [ ] Tokens stored in database

2. **Token Refresh**
   - [ ] Expire token manually (set `expiry_date` to past)
   - [ ] Make API call
   - [ ] Verify new token automatically fetched and stored

3. **Calendar Operations**
   - [ ] Fetch events from Google Calendar
   - [ ] Create event with Google Meet link
   - [ ] Update event
   - [ ] Delete event

4. **Disconnect**
   - [ ] User can disconnect calendar
   - [ ] Tokens removed from database
   - [ ] Token revoked with Google

---

## 📚 Files Created/Modified

### New Files ✨
- `drizzle/migrations-manual/012_add_google_oauth_columns.sql`
- `lib/integrations/google/oauth-tokens.ts`
- `docs/09-integrations/google-calendar-workos-migration.md`
- `docs/09-integrations/GOOGLE-CALENDAR-MIGRATION-SUMMARY.md` (this file)

### Modified Files 📝
- `drizzle/schema-workos.ts` - Added Google OAuth columns
- `server/googleCalendar.ts` - Marked as deprecated with migration notes

### Files To Create 🔨
- `app/api/auth/google/callback/route.ts` - OAuth callback handler
- `server/actions/google-calendar.ts` - Connect/disconnect actions
- `components/features/calendar/ConnectCalendarButton.tsx` - UI component

---

## ⏱️ Estimated Timeline

| Task | Time | Priority |
|------|------|----------|
| Database migration | 5 min | HIGH |
| WorkOS Dashboard config | 15 min | HIGH |
| Environment variables | 5 min | HIGH |
| Implement OAuth routes | 2 hours | HIGH |
| Update googleCalendar.ts | 1 hour | HIGH |
| UI components | 1 hour | MEDIUM |
| Testing | 1 hour | HIGH |
| Token encryption | 30 min | HIGH (prod) |
| Documentation review | 30 min | LOW |
| **Total** | **~6 hours** | |

---

## 🎯 Next Steps

1. **Review** this summary and the migration guide
2. **Plan** a 4-6 hour block for implementation
3. **Run** database migration
4. **Configure** WorkOS Dashboard
5. **Implement** OAuth routes and update code
6. **Test** thoroughly in development
7. **Deploy** to production

---

## 💡 Pro Tips

1. **Test token refresh early** - Don't wait until production to test automatic refresh
2. **Log everything** - Add detailed logging to debug OAuth flow
3. **Use state parameter** - Pass user info in OAuth state for better callback handling
4. **Keep refresh tokens safe** - These are long-lived and very sensitive
5. **Monitor token usage** - Track how often tokens are refreshed

---

## 🆘 Need Help?

- **OAuth Flow Issues**: Check WorkOS Dashboard logs
- **Token Refresh Issues**: Check database `google_token_expiry` timestamps
- **Google API Errors**: Verify scopes in WorkOS Dashboard match API needs
- **Migration Questions**: Refer to `google-calendar-workos-migration.md`

---

**Ready to migrate?** Follow the detailed guide in `docs/09-integrations/google-calendar-workos-migration.md`

Good luck! 🚀

