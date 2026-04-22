# WorkOS Google OAuth Configuration Guide

**Last Updated**: November 6, 2025  
**Status**: Required for Google Calendar Integration  
**Prerequisites**: WorkOS account with User Management enabled

---

## 🎯 Overview

This guide walks you through configuring WorkOS to enable Google OAuth for Google Calendar integration.

**What You'll Configure**:

- Google OAuth provider in WorkOS Dashboard
- OAuth scopes for calendar access
- Redirect URIs for callback handling
- Token return settings (CRITICAL)

**Time Required**: 15-20 minutes

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] WorkOS account with admin access
- [ ] Google Cloud Console project created
- [ ] Google Calendar API enabled
- [ ] Google OAuth credentials (Client ID + Secret)
- [ ] Application URLs (development + production)

---

## 🔧 Step 1: Google Cloud Console Setup

### Create OAuth Credentials

1. **Go to Google Cloud Console**
   - URL: https://console.cloud.google.com/apis/credentials
   - Select your project (or create new one)

2. **Enable Google Calendar API**
   - Navigation: APIs & Services → Library
   - Search: "Google Calendar API"
   - Click: **Enable**

3. **Create OAuth 2.0 Client ID**
   - Go to: APIs & Services → Credentials
   - Click: **+ CREATE CREDENTIALS** → OAuth client ID
   - Application type: **Web application**
   - Name: `Eleva Care - WorkOS (Production)` or `Eleva Care - WorkOS (Dev)`

4. **Configure Redirect URIs**

   Add these redirect URIs:

   ```
   Development:
   http://localhost:3000/api/auth/google/callback

   Production:
   https://eleva.care/api/auth/google/callback
   https://www.eleva.care/api/auth/google/callback
   ```

5. **Save OAuth Credentials**
   - Copy **Client ID**: `your-client-id.apps.googleusercontent.com`
   - Copy **Client Secret**: `GOCSPX-...`
   - **⚠️ Keep these secure - do not commit to git**

---

## 🌐 Step 2: WorkOS Dashboard Configuration

### Enable Google OAuth Provider

1. **Login to WorkOS Dashboard**
   - URL: https://dashboard.workos.com
   - Navigate to your environment (Development or Production)

2. **Go to User Management**
   - Sidebar: **User Management**
   - Tab: **Authentication methods**

3. **Enable Google OAuth**
   - Find: **Google OAuth** in provider list
   - Toggle: **Enable**

4. **Configure Google OAuth Settings**

   Enter your Google credentials:

   ```
   Client ID: [Paste from Google Cloud Console]
   Client Secret: [Paste from Google Cloud Console]
   ```

5. **⚠️ CRITICAL: Enable "Return OAuth tokens"**

   This is **REQUIRED** for our integration to work:
   - Find checkbox: **"Return OAuth access tokens"**
   - ✅ **CHECK THIS BOX**
   - Without this, WorkOS won't return tokens to your callback

   **Why This Matters**:
   - We need the OAuth tokens to access Google Calendar API
   - Without tokens, the integration won't work
   - This tells WorkOS to include tokens in the callback response

6. **Configure OAuth Scopes**

   Add these Google API scopes:

   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```

   **Scope Descriptions**:
   - `calendar` - Read/write calendar events
   - `calendar.events` - Full event management
   - `userinfo.email` - User's email address
   - `userinfo.profile` - User's basic profile

7. **Set Redirect URI**

   ```
   Development:
   http://localhost:3000/api/auth/google/callback

   Production:
   https://eleva.care/api/auth/google/callback
   ```

8. **Save Configuration**
   - Click: **Save** or **Update**
   - Verify: Green checkmark or success message

---

## 🔐 Step 3: Environment Variables

### Add to Your Application

Update your `.env.local` (development) and production environment variables:

```bash
# WorkOS Configuration (if not already set)
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_PASSWORD=...  # 32+ character random string
WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback

# Google OAuth Credentials
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Encryption Key (if not already set - MUST be same as medical records)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production Environment Variables

For Vercel/Production:

```bash
# Production URLs
GOOGLE_OAUTH_REDIRECT_URI=https://eleva.care/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://eleva.care

# Use Vercel Environment Variables UI or CLI:
vercel env add GOOGLE_OAUTH_CLIENT_ID production
vercel env add GOOGLE_OAUTH_CLIENT_SECRET production
vercel env add GOOGLE_OAUTH_REDIRECT_URI production
```

---

## 🧪 Step 4: Test Configuration

### 1. Test OAuth Flow (Development)

```bash
# Start your dev server
pnpm dev

# Navigate to:
http://localhost:3000/settings/integrations

# Click "Connect Google Calendar"
# Should redirect to Google authorization page
```

### 2. Verify WorkOS Returns Tokens

After authorization, check your server logs:

```
✅ Expected Log Output:
[Google OAuth Callback] Tokens received from WorkOS
[Google OAuth Callback] ✅ Tokens encrypted and stored for user: user_xxx

❌ If You See This:
[Google OAuth Callback] No access token received from WorkOS
```

**If No Tokens**:

- Go back to WorkOS Dashboard
- Verify: "Return OAuth access tokens" is ✅ **CHECKED**
- Save again and retry

### 3. Verify Token Encryption

Check database directly:

```sql
-- Tokens should be encrypted JSON
SELECT
  google_access_token,
  google_calendar_connected
FROM users
WHERE workos_user_id = 'user_xxx';

-- Expected: {"encryptedContent":"...", "iv":"...", "tag":"..."}
-- NOT: ya29.plaintext-token
```

### 4. Test Token Retrieval

In your application:

```typescript
import { getGoogleOAuthClient } from '@/lib/integrations/google/oauth-tokens';

// Should work without errors
const auth = await getGoogleOAuthClient(userId);
const calendar = google.calendar({ version: 'v3', auth });
const events = await calendar.events.list({ calendarId: 'primary' });
```

---

## 🐛 Troubleshooting

### Issue: "No OAuth tokens returned"

**Symptoms**:

- OAuth flow completes successfully
- No error message
- But tokens not in database

**Solution**:

1. WorkOS Dashboard → User Management → Google OAuth
2. Verify: ✅ **"Return OAuth access tokens"** is checked
3. Save configuration
4. Wait 2-3 minutes for propagation
5. Clear browser cookies and retry

---

### Issue: "Invalid redirect URI"

**Symptoms**:

- Google shows error: "redirect_uri_mismatch"

**Solution**:

1. Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add exact callback URL (including http/https)
4. Common mistakes:
   - Missing `/api/auth/google/callback` path
   - Wrong protocol (http vs https)
   - Trailing slash difference
   - Missing www subdomain

---

### Issue: "Insufficient permissions"

**Symptoms**:

- OAuth succeeds but can't access calendar
- API returns 403 Forbidden

**Solution**:

1. Check scopes in WorkOS configuration
2. Ensure `calendar` and `calendar.events` scopes are added
3. User must re-authorize after scope changes
4. Disconnect and reconnect Google Calendar

---

### Issue: "Token encryption fails"

**Symptoms**:

- Error: "ENCRYPTION_KEY not set"
- Or: "Invalid encryption key"

**Solution**:

1. Verify `ENCRYPTION_KEY` is set in environment
2. Must be 32 bytes (256 bits)
3. Should be same key used for medical records
4. Generate new key if needed:
   ```bash
   openssl rand -hex 32
   ```

---

## 📊 Verification Checklist

After configuration, verify each item:

### WorkOS Dashboard

- [ ] Google OAuth provider enabled
- [ ] Client ID configured
- [ ] Client Secret configured
- [ ] ✅ **"Return OAuth access tokens" is CHECKED** ← CRITICAL
- [ ] Scopes include `calendar` and `calendar.events`
- [ ] Redirect URI matches your application URL

### Google Cloud Console

- [ ] OAuth client created
- [ ] Redirect URIs match exactly
- [ ] Google Calendar API enabled
- [ ] Credentials copied to environment variables

### Application

- [ ] Environment variables set
- [ ] Server starts without errors
- [ ] Callback route responds (check `/api/auth/google/callback`)
- [ ] Database has OAuth columns (google_access_token, etc.)

### End-to-End Test

- [ ] "Connect Calendar" button works
- [ ] Redirects to Google authorization
- [ ] Callback receives tokens
- [ ] Tokens encrypted in database
- [ ] Can retrieve and decrypt tokens
- [ ] Can list calendar events
- [ ] Disconnect works properly

---

## 🔒 Security Notes

### Token Security

1. **Tokens Are Encrypted**
   - All OAuth tokens encrypted with AES-256-GCM
   - Same encryption as medical records
   - Requires `ENCRYPTION_KEY` environment variable

2. **Key Management**
   - Store `ENCRYPTION_KEY` in secrets manager (production)
   - Never commit keys to git
   - Use same key across all environments for data portability

3. **Scope Minimization**
   - Only request calendar scopes needed
   - Don't request additional Google scopes unless required
   - Users can review scopes during authorization

### OAuth Security

1. **State Parameter**
   - Used for CSRF protection
   - Encodes return URL
   - Validated in callback

2. **HTTPS Required**
   - Production MUST use HTTPS
   - Google blocks non-HTTPS redirects (except localhost)
   - WorkOS requires HTTPS for production

3. **Token Refresh**
   - Refresh tokens are long-lived
   - Access tokens expire (usually 1 hour)
   - Automatic refresh handled by `getGoogleOAuthClient()`

---

## 📚 Additional Resources

### WorkOS Documentation

- [OAuth Integration Guide](https://workos.com/docs/user-management/oauth)
- [Google OAuth Provider](https://workos.com/docs/integrations/google)
- [Return OAuth Tokens](https://workos.com/docs/user-management/oauth#return-oauth-tokens)

### Google Documentation

- [OAuth 2.0 Overview](https://developers.google.com/identity/protocols/oauth2)
- [Calendar API Scopes](https://developers.google.com/calendar/api/auth)
- [Calendar API Quickstart](https://developers.google.com/calendar/api/quickstart/nodejs)

### Internal Documentation

- `docs/09-integrations/IMPLEMENTATION-COMPLETE.md` - Full implementation guide
- `docs/09-integrations/ENCRYPTION-IMPLEMENTATION.md` - Encryption details
- `lib/integrations/google/oauth-tokens.ts` - Token management code

---

## ✅ Configuration Complete

Once all items in the checklist are verified, your Google Calendar integration is ready!

**Next Steps**:

1. Deploy to production
2. Update production environment variables
3. Configure production redirect URIs
4. Test in production environment
5. Monitor for OAuth errors
6. Set up alerts for connection failures

---

**Need Help?**

- Check troubleshooting section above
- Review server logs for detailed errors
- Verify WorkOS Dashboard configuration
- Ensure "Return OAuth tokens" is enabled
- Check Google Cloud Console redirect URIs

**Critical Reminder**: ✅ **"Return OAuth access tokens" MUST be checked in WorkOS Dashboard!**
