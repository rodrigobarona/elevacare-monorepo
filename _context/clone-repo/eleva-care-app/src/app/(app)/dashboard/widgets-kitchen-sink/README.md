# WorkOS Widgets Kitchen Sink

A comprehensive showcase of all available WorkOS widgets with live demos, implementation examples, and documentation.

## 🎯 Purpose

This kitchen sink page helps you:

1. **Explore** all available WorkOS widgets in one place
2. **Test** widget functionality with live demos
3. **Understand** use cases and permissions for each widget
4. **Copy** implementation examples for your own pages

## 📍 Access

Visit: `/dashboard/widgets-kitchen-sink`

**Requirements:**

- Authenticated user
- Organization membership
- Appropriate permissions for certain widgets

## 🧩 Available Widgets

### User Management Category

#### 1. **User Management** (`UsersManagement`)

**Purpose:** Manage organization users, invite members, modify roles

**Required Scopes:**

- `widgets:users-table:manage`

**Permissions:**

- Requires organization admin role

**Use Cases:**

- Organization admin dashboard
- Team management pages
- User provisioning workflows

**Where to Add:**

```
✅ /dashboard/organization/team
✅ /dashboard/admin/users
❌ User settings (use UserProfile instead)
```

---

#### 2. **User Profile** (`UserProfile`)

**Purpose:** Display and edit user profile details

**Required Scopes:**

- `widgets:users-table:read`

**Permissions:**

- Any authenticated user

**Use Cases:**

- User settings page
- Profile management
- Account details

**Where to Add:**

```
✅ /dashboard/settings/profile
✅ /dashboard/account
✅ User dropdown menu → Profile
```

---

### Security Category

#### 3. **User Security** (`UserSecurity`)

**Purpose:** Manage passwords and MFA settings

**Required Scopes:**

- `widgets:users-table:read`

**Permissions:**

- Any authenticated user

**Use Cases:**

- Security settings page
- Password management
- MFA setup

**Where to Add:**

```
✅ /dashboard/settings/security
✅ /dashboard/account/security
✅ Settings menu → Security
```

---

#### 4. **User Sessions** (`UserSessions`)

**Purpose:** View and manage active sessions across devices

**Required Scopes:**

- `widgets:users-table:read`

**Permissions:**

- Any authenticated user

**Special Props:**

- `currentSessionId` - Required to highlight the current session

**Use Cases:**

- Security dashboard
- Session management
- Device tracking

**Where to Add:**

```
✅ /dashboard/settings/security/sessions
✅ /dashboard/account/sessions
✅ Security → Active Sessions
```

---

### Developer Tools Category

#### 5. **User API Keys** (`ApiKeys`)

**Purpose:** Generate and manage API keys

**Required Scopes:**

- `widgets:users-table:read`

**Permissions:**

- Any authenticated user

**Use Cases:**

- Developer settings
- API key management
- Integration setup

**Where to Add:**

```
✅ /dashboard/settings/api-keys
✅ /dashboard/developers/api-keys
✅ Settings → Developer Tools
```

---

### Admin Portal Category

#### 6. **Domain Verification** (`AdminPortalDomainVerification`)

**Purpose:** Verify domains for SSO setup

**Required Scopes:**

- `widgets:domain-verification:manage`

**Permissions:**

- Requires `widgets:domain-verification:manage` permission

**Use Cases:**

- SSO setup workflow
- Domain verification
- Organization setup

**Where to Add:**

```
✅ /dashboard/admin/sso/setup (Step 1)
✅ /dashboard/organization/domains
❌ Regular user settings (admin only)
```

---

#### 7. **SSO Connection** (`AdminPortalSsoConnection`)

**Purpose:** Configure Single Sign-On connections

**Required Scopes:**

- `widgets:sso:manage`

**Permissions:**

- Requires `widgets:sso:manage` permission

**Use Cases:**

- Enterprise SSO setup
- SAML configuration
- Organization authentication

**Where to Add:**

```
✅ /dashboard/admin/sso
✅ /dashboard/organization/authentication
❌ Regular user settings (admin only)
```

---

## 📋 Widget Comparison Matrix

| Widget              | Category        | User Level | Admin Only | Use in Settings | Use in Admin |
| ------------------- | --------------- | ---------- | ---------- | --------------- | ------------ |
| User Management     | User Management | ❌         | ✅         | ❌              | ✅           |
| User Profile        | User Management | ✅         | ❌         | ✅              | ❌           |
| User Security       | Security        | ✅         | ❌         | ✅              | ❌           |
| User Sessions       | Security        | ✅         | ❌         | ✅              | ❌           |
| User API Keys       | Developer Tools | ✅         | ❌         | ✅              | ❌           |
| Domain Verification | Admin Portal    | ❌         | ✅         | ❌              | ✅           |
| SSO Connection      | Admin Portal    | ❌         | ✅         | ❌              | ✅           |

## 🛠️ Implementation Guide

### 1. Generate Widget Token (Server Component)

```typescript
import { workos } from '@/lib/integrations/workos/client';

// Server Component
export default async function SettingsPage() {
  const { user, organizationId } = await withAuth({ ensureSignedIn: true });

  // Generate token with required scopes
  const profileToken = await workos.widgets.getToken({
    userId: user.id,
    organizationId,
    scopes: ['widgets:users-table:read'],
  });

  return <ProfileWidget authToken={profileToken.token} />;
}
```

### 2. Render Widget (Client Component)

```typescript
'use client';

import { UserProfile, WorkOsWidgets } from '@workos-inc/widgets';

export function ProfileWidget({ authToken }: { authToken: string }) {
  return (
    <WorkOsWidgets>
      <UserProfile authToken={authToken} />
    </WorkOsWidgets>
  );
}
```

### 3. Add CORS Configuration

Ensure your domain is added to WorkOS CORS settings:

**WorkOS Dashboard** → **Authentication** → **Web Origins**

Add:

- `http://localhost:3000` (development)
- `https://yourdomain.com` (production)

## 📁 Recommended Page Structure

```
app/
├── (private)/
│   ├── dashboard/
│   │   ├── settings/
│   │   │   ├── profile/              → UserProfile
│   │   │   ├── security/             → UserSecurity
│   │   │   │   └── sessions/         → UserSessions
│   │   │   └── api-keys/             → ApiKeys
│   │   ├── admin/
│   │   │   ├── users/                → UsersManagement
│   │   │   └── sso/
│   │   │       ├── domains/          → AdminPortalDomainVerification
│   │   │       └── connections/      → AdminPortalSsoConnection
```

## 🔒 Permissions & Scopes

### Widget Scopes

| Scope                                | Description                | Widgets                                          |
| ------------------------------------ | -------------------------- | ------------------------------------------------ |
| `widgets:users-table:manage`         | Full user management       | UsersManagement                                  |
| `widgets:users-table:read`           | Read user data             | UserProfile, UserSecurity, UserSessions, ApiKeys |
| `widgets:domain-verification:manage` | Manage domain verification | AdminPortalDomainVerification                    |
| `widgets:sso:manage`                 | Manage SSO connections     | AdminPortalSsoConnection                         |

### Token Expiration

Widget tokens expire after **1 hour**. For long-lived pages, implement token refresh:

```typescript
// Option 1: Use getAccessToken from useAuth (AuthKit React)
import { useAuth } from '@workos-inc/authkit-react';

export function Widget() {
  const { getAccessToken } = useAuth();

  return (
    <WorkOsWidgets>
      <UserProfile authToken={getAccessToken} />
    </WorkOsWidgets>
  );
}

// Option 2: Server-side token generation (Next.js App Router)
// Tokens auto-refresh when page revalidates
```

## 🎨 Styling Widgets

Widgets use Radix Themes for styling. Customize via `WorkOsWidgets` provider:

```typescript
import { Theme } from '@radix-ui/themes';
import { WorkOsWidgets } from '@workos-inc/widgets';

<WorkOsWidgets>
  <Theme appearance="light" accentColor="blue">
    <UserProfile authToken={authToken} />
  </Theme>
</WorkOsWidgets>
```

## 🚨 Common Issues & Solutions

### Issue: CORS Error

**Symptom:** `Access to fetch at 'https://api.workos.com/...' blocked by CORS`

**Solution:**

1. Go to WorkOS Dashboard → Authentication → Web Origins
2. Add your domain (e.g., `http://localhost:3000`)
3. Clear browser cache

### Issue: "Insufficient Permissions"

**Symptom:** Widget shows permission error

**Solution:**

1. Check required scopes in documentation
2. Verify token generation includes correct scopes
3. Check user's organization role

### Issue: Widget Not Loading

**Symptom:** Blank widget or loading spinner

**Solution:**

1. Verify token is valid (check expiration)
2. Ensure `WorkOsWidgets` wrapper is present
3. Check browser console for errors
4. Verify packages are installed:
   ```bash
   pnpm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
   ```

## 📚 Resources

- [WorkOS Widgets Documentation](https://workos.com/docs/widgets/quick-start)
- [WorkOS Widgets Examples (GitHub)](https://github.com/workos/widgets-examples)
- [Radix Themes Documentation](https://www.radix-ui.com/themes/docs)
- [WorkOS Dashboard](https://dashboard.workos.com)

## 🔄 Next Steps

After exploring the kitchen sink:

1. **Identify** which widgets fit your use cases
2. **Plan** your page structure based on recommendations
3. **Implement** widgets in appropriate pages
4. **Test** permissions and user roles
5. **Style** widgets to match your brand

## 📝 Notes

- Widget tokens are scoped to a specific organization and user
- Tokens expire after 1 hour
- Some widgets require admin permissions
- All widgets are client-side React components
- CORS must be configured in WorkOS Dashboard
