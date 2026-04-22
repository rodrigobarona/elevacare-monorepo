# Clerk Core 2 (v6) Configuration Guide

This document outlines the proper configuration for Clerk Core 2 (v6) in our application, including OAuth integration fixes.

## Environment Variables

In Clerk Core 2, the redirection URL handling has changed significantly. Here are the updated environment variables to use:

### Required Variables

```env
# Authentication (Clerk Core 2)
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_WEBHOOK_SIGNING_SECRET=your_webhook_secret

# Clerk Core 2 Redirect URLs (Required for proper OAuth handling)
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/dashboard"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/dashboard"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL="/"

# Optional Force Redirect URLs (use with caution - interrupts user flow)
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=""
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=""
```

### Key Changes from Core 1

1. **Removed Dashboard Path Configuration**: Redirect URLs can no longer be configured in the Clerk Dashboard
2. **New Environment Variables**: Force and fallback redirect URLs replace the deprecated `afterSignXUrl` pattern
3. **Improved OAuth Handling**: External account connections use the `AuthenticateWithRedirectCallback` component

## OAuth Configuration

### Google Account Integration

The OAuth flow has been completely rewritten for Core 2:

#### Before (Core 1 - Deprecated):

```javascript
// ❌ DEPRECATED - Don't use
window.Clerk.authenticateWithRedirect({
  strategy: 'oauth_google',
  redirectUrl: callbackUrl,
});
```

#### After (Core 2 - Current):

```javascript
// ✅ CORRECT - Core 2 approach
const externalAccount = await user.createExternalAccount({
  strategy: 'oauth_google',
  redirectUrl: callbackUrl, // camelCase in Core 2
});

if (externalAccount?.verification?.externalVerificationRedirectURL) {
  window.location.href = externalAccount.verification.externalVerificationRedirectURL.toString();
}
```

### Callback Page Implementation

Use the `AuthenticateWithRedirectCallback` component properly:

```jsx
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function CallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/account/security"
      signUpFallbackRedirectUrl="/account/security"
    />
  );
}
```

## Password Management

Core 2 has updated password management requirements:

### Password Updates

```javascript
// ✅ Core 2 - requires currentPassword for existing users
await user.updatePassword({
  currentPassword: 'current_password',
  newPassword: 'new_password',
  signOutOfOtherSessions: true, // Recommended for security
});

// ❌ DEPRECATED - Core 1 pattern
await user.update({ password: 'new_password' });
```

## Troubleshooting OAuth Issues

### Common Issues and Solutions

1. **"API Key not found" Error**
   - Ensure `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` are set
   - Verify the keys are from the correct Clerk instance/environment

2. **Redirect URL Mismatch**
   - Check that callback URLs match exactly in Clerk Dashboard
   - Ensure protocol (http/https) matches between development and production
   - Format: `https://yourdomain.com/account/security/callback`

3. **OAuth Flow Stuck in Loading**
   - Verify `AuthenticateWithRedirectCallback` is implemented correctly
   - Check browser network tab for failed requests
   - Ensure fallback redirect URLs are configured

4. **External Account Creation Fails**
   - Verify Google OAuth is enabled in Clerk Dashboard
   - Check that `redirectUrl` parameter uses camelCase (Core 2)
   - Ensure the callback URL is whitelisted

### Debug Configuration

Add this to check your Core 2 setup:

```javascript
console.log('Clerk Core 2 Config:', {
  callbackUrl: `${window.location.origin}/account/security/callback`,
  fallbackRedirectUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  environment: process.env.NODE_ENV,
});
```

## Migration Checklist

- [ ] Update environment variables to Core 2 format
- [ ] Replace deprecated `afterSignXUrl` with `signXFallbackRedirectUrl`
- [ ] Update OAuth callback to use `AuthenticateWithRedirectCallback`
- [ ] Fix external account creation to use `redirectUrl` (camelCase)
- [ ] Update password management to use `updatePassword()` method
- [ ] Remove global Clerk object dependencies
- [ ] Test OAuth flow end-to-end

## Security Considerations

1. **Force Redirect URLs**: Use sparingly as they interrupt user flow
2. **Fallback Redirect URLs**: Safer option that respects user navigation context
3. **Sign Out of Other Sessions**: Enable when changing passwords for security
4. **Callback URL Validation**: Ensure callback URLs are properly whitelisted in production

For additional support, see the [official Clerk Core 2 upgrade guide](https://clerk.com/docs/upgrade-guides/core-2).
