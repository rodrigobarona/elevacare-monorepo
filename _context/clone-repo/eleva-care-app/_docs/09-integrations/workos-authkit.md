# WorkOS AuthKit Integration

## Overview

This application uses [WorkOS AuthKit](https://workos.com/docs/user-management) for enterprise-grade authentication. AuthKit provides hosted authentication UI with support for email/password, OAuth providers (Google, GitHub, Microsoft), and enterprise SSO.

## Key Features

- **Hosted Authentication UI**: WorkOS manages the entire auth UI
- **OAuth Providers**: Google, GitHub, Microsoft, and more
- **Enterprise SSO**: SAML and OIDC for enterprise customers
- **Email Verification**: Automatic email verification flow
- **Password Reset**: Secure password reset via email
- **Multi-Factor Authentication (MFA)**: TOTP, SMS, and authenticator apps
- **Session Management**: Encrypted cookies with automatic refresh
- **Organizations**: Multi-tenant support with team management

## Architecture

### Authentication Flow

```
User → Login Page → WorkOS AuthKit UI → Callback → Application
                                             ↓
                                    Sync to Database
```

1. **User visits protected route**
   - Middleware checks session
   - Redirects to `/login` if not authenticated

2. **Login page redirects to WorkOS**
   - Generates sign-in URL with state
   - User sees WorkOS hosted UI

3. **User authenticates**
   - Enters credentials or uses OAuth
   - WorkOS validates and creates session

4. **Callback handler processes response**
   - Exchanges auth code for tokens
   - Creates encrypted session cookie
   - Syncs user data to database
   - Redirects to destination

5. **User accesses application**
   - Session cookie validated on each request
   - WorkOS automatically refreshes tokens

## Installation

The AuthKit Next.js package is already installed:

```json
{
  "@workos-inc/authkit-nextjs": "latest",
  "@workos-inc/node": "latest"
}
```

## Configuration

### Environment Variables

```bash
# WorkOS Authentication (Required)
WORKOS_API_KEY=sk_xxx                    # Secret API Key
WORKOS_CLIENT_ID=client_xxx               # Client ID
WORKOS_COOKIE_PASSWORD=xxx                # 32+ character password
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

# WorkOS Webhooks (Required for sync)
WORKOS_WEBHOOK_SECRET=xxx                 # Webhook signing secret

# Public URLs (Optional)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Get Credentials

1. **Sign up** at [workos.com](https://workos.com)
2. **Create application** in dashboard
3. **Copy credentials**:
   - API Key (under API Keys)
   - Client ID (under Configuration)
4. **Set redirect URI**: Add `http://localhost:3000/api/auth/callback`
5. **Generate cookie password**: `openssl rand -base64 24`

## Components

### Server Components

#### Check Authentication Status

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function ProtectedPage() {
  const { user } = await withAuth();

  if (!user) {
    redirect('/login');
  }

  return <div>Welcome {user.firstName}!</div>;
}
```

#### Get User with Organization

```typescript
import { withAuth } from '@workos-inc/authkit-nextjs';

export default async function DashboardPage() {
  const { user, organizationId, role, permissions } = await withAuth();

  return (
    <div>
      <h1>Welcome {user.firstName}</h1>
      <p>Organization: {organizationId}</p>
      <p>Role: {role}</p>
      <p>Permissions: {permissions?.join(', ')}</p>
    </div>
  );
}
```

#### Using AuthWrapper Component

```typescript
import { AuthWrapper } from '@/components/auth/AuthWrapper';

export default function ProtectedPage() {
  return (
    <AuthWrapper redirectTo="/login">
      <YourProtectedContent />
    </AuthWrapper>
  );
}
```

### Client Components

#### Check Authentication in Client

```typescript
'use client';

import { useAuth } from '@workos-inc/authkit-nextjs/components';

export function UserProfile() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h2>{user.firstName} {user.lastName}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

#### Using Auth Components

```typescript
import { LogoutButton } from '@/components/auth/LogoutButton';
import { AuthStatus } from '@/components/auth/AuthStatus';

export function Header() {
  return (
    <header>
      <AuthStatus />
      <LogoutButton />
    </header>
  );
}
```

## Available Auth Components

### AuthWrapper

Server component that protects routes:

```typescript
<AuthWrapper redirectTo="/login">
  <ProtectedContent />
</AuthWrapper>
```

### LogoutButton

Client component with loading states:

```typescript
// Basic usage
<LogoutButton />

// With confirmation
<LogoutButton confirmBeforeLogout>
  Sign Out
</LogoutButton>

// Custom styling
<LogoutButton variant="destructive" size="sm" />
```

### LogoutForm

Server component using server actions:

```typescript
<LogoutForm variant="ghost" />
```

### AuthStatus

Server component displaying user info:

```typescript
// Full display
<AuthStatus showRole showOrganization />

// Compact version
<AuthStatusCompact />
```

## Authentication Routes

### Login Page

```typescript
// app/(auth)/login/page.tsx
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/dashboard';

  const signInUrl = await getSignInUrl({
    state: JSON.stringify({
      returnTo: redirectUrl,
    }),
  });

  redirect(signInUrl);
}
```

**Features**:

- Elegant loading animation
- Shows redirect destination
- Handles error states
- OAuth provider preview

### Register Page

```typescript
// app/(auth)/register/page.tsx
export default async function RegisterPage({ searchParams }) {
  const params = await searchParams;
  const redirectUrl = params.redirect_url || '/onboarding';

  const signUpUrl = await getSignUpUrl({
    state: JSON.stringify({
      returnTo: redirectUrl,
    }),
  });

  redirect(signUpUrl);
}
```

**Features**:

- Registration flow with redirect
- OAuth provider options
- Link to login page
- Benefits preview

### Callback Handler

```typescript
// app/api/auth/callback/route.ts
export const GET = handleAuth({
  returnPathname: '/dashboard',

  onSuccess: async ({ user, organizationId }) => {
    // Sync user to database
    await syncWorkOSUserToDatabase({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  },
});
```

**Features**:

- Automatic session creation
- User data synchronization
- Non-blocking error handling
- Custom state processing

## Middleware

Next.js 16 uses `proxy.ts` (renamed from `middleware.ts`):

```typescript
// proxy.ts
import { authkit } from '@workos-inc/authkit-nextjs';

export default async function proxy(request: NextRequest) {
  const { session, headers } = await authkit(request);

  if (!session.user) {
    // Redirect to login
    return NextResponse.redirect(authorizationUrl);
  }

  // User is authenticated
  return NextResponse.next();
}
```

**Features**:

- Automatic session validation
- Token refresh
- Cookie management
- Route protection

## User Synchronization

See [WorkOS Sync Architecture](../02-core-systems/workos-sync-architecture.md) for complete details.

### Immediate Sync (Callback)

User data synced immediately after authentication:

```typescript
// In callback handler
await syncWorkOSUserToDatabase({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  profilePictureUrl: user.profilePictureUrl,
});
```

**Syncs**:

- User record (email, WorkOS ID)
- Profile data (firstName, lastName)
- Organization membership
- Profile picture URL

### Real-Time Sync (Webhooks)

Database stays in sync via webhooks:

```typescript
// app/api/webhooks/workos/route.ts
export async function POST(request: NextRequest) {
  const event = workos.webhooks.constructEvent({...});

  switch (event.event) {
    case 'user.updated':
      await fullUserSync(event.data.id);
      break;
    case 'user.deleted':
      await deleteUserFromDatabase(event.data.id);
      break;
  }

  return NextResponse.json({ received: true });
}
```

**Webhook Events**:

- `user.created` - New user
- `user.updated` - Profile changed
- `user.deleted` - Account deleted
- `organization_membership.*` - Membership changes
- `dsync.*` - Directory Sync (Enterprise SSO)

## OAuth Providers

### Configure Providers

1. **Navigate** to WorkOS Dashboard
2. **Go to** Authentication → Social Connections
3. **Add providers**:
   - Google OAuth
   - GitHub OAuth
   - Microsoft OAuth
4. **Add credentials** from provider dashboards
5. **Test** authentication flow

### Provider Setup

#### Google OAuth

1. **Visit** [Google Cloud Console](https://console.cloud.google.com)
2. **Create** OAuth 2.0 credentials
3. **Set redirect URI**: WorkOS provides the URI
4. **Copy** Client ID and Secret to WorkOS

#### GitHub OAuth

1. **Visit** GitHub Settings → Developer Settings → OAuth Apps
2. **Create** new OAuth App
3. **Set callback URL**: From WorkOS Dashboard
4. **Copy** Client ID and Secret to WorkOS

## Enterprise SSO

### SAML Configuration

1. **Navigate** to WorkOS Dashboard → Organizations
2. **Create** organization
3. **Add** SAML connection
4. **Share** ACS URL and Entity ID with customer
5. **Receive** SAML metadata from customer
6. **Test** connection

### OIDC Configuration

1. **Create** organization in dashboard
2. **Add** OIDC connection
3. **Configure** client ID and secret from IdP
4. **Set** discovery endpoint
5. **Test** authentication

## Security Best Practices

### 1. Cookie Password

Use a strong, random password (32+ characters):

```bash
# Generate secure password
openssl rand -base64 24

# Add to .env
WORKOS_COOKIE_PASSWORD=your-generated-password
```

### 2. Webhook Verification

Always verify webhook signatures:

```typescript
// ✅ Good - Verify signature
const event = workos.webhooks.constructEvent({
  payload,
  sigHeader,
  secret: WORKOS_WEBHOOK_SECRET,
});

// ❌ Bad - Trust payload without verification
const event = JSON.parse(payload);
```

### 3. HTTPS in Production

WorkOS requires HTTPS for:

- Redirect URIs
- Webhook endpoints
- Cookie security

### 4. Environment Variables

Never commit credentials:

```bash
# ✅ Good - Use .env files
WORKOS_API_KEY=sk_xxx

# ❌ Bad - Hardcode in code
const apiKey = 'sk_xxx';
```

## Troubleshooting

### "Invalid redirect URI"

**Cause**: Redirect URI doesn't match WorkOS configuration

**Solution**:

1. Check `.env`: `WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback`
2. Check WorkOS Dashboard: Ensure URI matches exactly
3. For production: Use HTTPS and correct domain

### Session Not Persisting

**Cause**: Cookie password too short or missing

**Solution**:

1. Verify `WORKOS_COOKIE_PASSWORD` is 32+ characters
2. Regenerate: `openssl rand -base64 24`
3. Restart server after updating

### User Data Not Syncing

**Cause**: Sync function error or webhook not configured

**Solution**:

1. Check callback logs for sync errors
2. Verify webhook configured in WorkOS Dashboard
3. Test webhook endpoint: Send test event
4. Check webhook secret matches `.env`

### "Authentication failed"

**Cause**: Invalid credentials or misconfiguration

**Solution**:

1. Verify `WORKOS_API_KEY` is correct (starts with `sk_`)
2. Verify `WORKOS_CLIENT_ID` is correct (starts with `client_`)
3. Check WorkOS Dashboard for API key status
4. Ensure keys match the correct environment (test/prod)

## Testing

### Manual Testing

```typescript
// Test authentication
1. Visit http://localhost:3000/login
2. Sign in with test credentials
3. Verify redirect to dashboard
4. Check database for user record

// Test logout
1. Click logout button
2. Verify redirect to homepage
3. Try accessing protected route
4. Verify redirect to login
```

### Integration Testing

```typescript
// Example test
test('user can sign in and access dashboard', async () => {
  // 1. Navigate to login
  await page.goto('/login');

  // 2. Complete auth flow
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 3. Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');

  // 4. Verify user data visible
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

## Migration from Clerk

If migrating from Clerk:

1. **Run migration script**: `pnpm migration:clerk-to-workos`
2. **Update environment variables**: Replace Clerk vars with WorkOS
3. **Test authentication flow**: Verify sign-in/sign-up works
4. **Update auth checks**: Replace `auth()` with `withAuth()`
5. **Update client components**: Replace `useUser()` with `useAuth()`
6. **Test webhooks**: Ensure sync working
7. **Deploy gradually**: Use feature flags for rollout

## Performance Optimization

### 1. Use Cached Roles

```typescript
// ✅ Good - Use cached role function
import { getCachedUserRoles } from '@/lib/integrations/workos/roles';

const roles = await getCachedUserRoles(userId);

// ❌ Bad - Fetch every time
const roles = await getUserRoles(userId);
```

### 2. Parallel Data Fetching

```typescript
// ✅ Good - Fetch in parallel
const [user, profile] = await Promise.all([
  withAuth(),
  getProfile(userId),
]);

// ❌ Bad - Sequential fetching
const user = await withAuth();
const profile = await getProfile(userId);
```

### 3. Conditional Sync

```typescript
// ✅ Good - Only sync if changed
if (webhookUser.email !== dbUser.email) {
  await syncUser(webhookUser);
}

// ❌ Bad - Always sync
await syncUser(webhookUser);
```

## Resources

- [WorkOS Docs](https://workos.com/docs/user-management)
- [AuthKit Next.js Docs](https://workos.com/docs/user-management/authkit-nextjs)
- [WorkOS Dashboard](https://dashboard.workos.com)
- [WorkOS Support](mailto:support@workos.com)
- [Sync Architecture](../02-core-systems/workos-sync-architecture.md)

## Support

For issues:

1. Check [troubleshooting](#troubleshooting) section
2. Review WorkOS Dashboard logs
3. Check application logs
4. Contact WorkOS support: support@workos.com
