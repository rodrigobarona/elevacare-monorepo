# WorkOS Synchronization Architecture

## Overview

This document describes the synchronization architecture between WorkOS (authentication provider) and the application database. WorkOS serves as the **single source of truth** for user and organization data, with the database acting as a performance cache and relationship store.

## Core Principles

### 1. Single Source of Truth

**WorkOS is authoritative** for:

- User identity (email, name, profile picture)
- User authentication state
- Organization membership
- Roles within organizations

**Database is authoritative** for:

- Application-specific data (expert profiles, appointments, etc.)
- Relationships between entities
- Performance-critical queries

### 2. Sync Strategies

We use two complementary sync strategies:

#### A. Immediate Sync (Callback Handler)

- **When**: User signs in or signs up
- **Where**: `app/api/auth/callback/route.ts`
- **What**: User data, profile data, organization memberships
- **Purpose**: Ensure user data available immediately after auth

#### B. Real-Time Sync (Webhooks)

- **When**: Data changes in WorkOS
- **Where**: `app/api/webhooks/workos/route.ts`
- **What**: User updates, deletions, membership changes
- **Purpose**: Keep database in sync with WorkOS changes

### 3. Sync Never Blocks Authentication

**Critical Rule**: Database sync failures MUST NOT prevent user authentication.

```typescript
// ✅ Good - Non-blocking sync
try {
  await syncWorkOSUserToDatabase(user);
} catch (error) {
  console.error('Sync failed (non-blocking):', error);
  // User is still authenticated
}

// ❌ Bad - Blocking sync
await syncWorkOSUserToDatabase(user); // Throws on error
// Authentication fails if sync fails
```

## Architecture Components

### 1. Sync Utilities (`lib/integrations/workos/sync.ts`)

Core synchronization functions:

#### User Sync Functions

```typescript
// Fetch user from WorkOS (source of truth)
const workosUser = await getWorkOSUserById('user_01H...');

// Sync user to database (upsert)
await syncWorkOSUserToDatabase({
  id: workosUser.id,
  email: workosUser.email,
  firstName: workosUser.firstName,
  lastName: workosUser.lastName,
});

// Sync profile data (firstName/lastName)
await syncUserProfileData(workosUser);

// Full sync (user + profile + memberships)
await fullUserSync('user_01H...');

// Delete user from database
await deleteUserFromDatabase('user_01H...');
```

#### Organization Sync Functions

```typescript
// Sync organization
await syncWorkOSOrganizationToDatabase(
  {
    id: 'org_01H...',
    name: "Dr. Maria's Practice",
    slug: 'dr-maria-practice',
  },
  'expert_individual',
);

// Sync membership
await syncUserOrgMembership(membership);

// Sync all memberships for org
await syncOrganizationMemberships('org_01H...');

// Update membership role
await updateMembershipRole('user_01H...', 'org_01H...', 'admin');
```

### 2. Callback Handler (`app/api/auth/callback/route.ts`)

Handles immediate sync after authentication:

```typescript
export const GET = handleAuth({
  returnPathname: '/dashboard',

  onSuccess: async ({ user }) => {
    // Sync user to database (WorkOS as source of truth)
    const syncResult = await syncWorkOSUserToDatabase({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Non-blocking error handling
    if (!syncResult.success) {
      console.error('Sync failed (non-blocking):', syncResult.error);
    }
  },
});
```

**Flow**:

1. User signs in via WorkOS
2. WorkOS redirects to `/api/auth/callback`
3. `handleAuth()` creates encrypted session
4. `onSuccess()` syncs user to database
5. User redirected to destination

### 3. Webhook Handler (`app/api/webhooks/workos/route.ts`)

Handles real-time sync for data changes:

```typescript
export async function POST(request: NextRequest) {
  // Verify webhook signature
  const event = workos.webhooks.constructEvent({
    payload,
    sigHeader,
    secret: WORKOS_WEBHOOK_SECRET,
  });

  // Handle events
  switch (event.event) {
    case 'user.updated':
      await fullUserSync(event.data.id);
      break;

    case 'user.deleted':
      await deleteUserFromDatabase(event.data.id);
      break;

    case 'organization_membership.created':
      await syncUserOrgMembership(event.data);
      break;
  }

  // Always return 200 quickly
  return NextResponse.json({ received: true });
}
```

**Supported Events**:

- `user.created` - New user registered
- `user.updated` - Profile changed (name, email, etc.)
- `user.deleted` - Account deleted
- `organization_membership.created` - User joined org
- `organization_membership.updated` - Role changed
- `organization_membership.deleted` - User left org
- `dsync.user.*` - Directory Sync events (Enterprise SSO)
- `organization.*` - Organization CRUD events

## Data Flow Diagrams

### User Registration Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │         │   WorkOS    │         │  Database   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. Click Sign Up      │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │ 2. Show Sign Up Form  │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 3. Submit Form        │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │                       │ 4. Create User        │
       │                       │       (Source of Truth)
       │                       │                       │
       │ 5. Redirect /callback │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 6. Exchange Code      │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │ 7. User Data          │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │                       │ 8. Sync User          │
       │                       ├──────────────────────>│
       │                       │                       │
       │                       │ 9. Create Profile     │
       │                       ├──────────────────────>│
       │                       │                       │
       │ 10. Redirect Dashboard│                       │
       │<──────────────────────┤                       │
```

### Webhook Sync Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   WorkOS    │         │   Webhook   │         │  Database   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. User Updated       │                       │
       │       (Source of Truth)                       │
       │                       │                       │
       │ 2. Send Webhook       │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │                       │ 3. Verify Signature   │
       │                       │                       │
       │                       │ 4. Fetch Fresh Data   │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 5. User Data          │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │                       │ 6. Update User        │
       │                       ├──────────────────────>│
       │                       │                       │
       │                       │ 7. Update Profile     │
       │                       ├──────────────────────>│
       │                       │                       │
       │ 8. 200 OK             │                       │
       │<──────────────────────┤                       │
```

## Database Schema

### Users Table

```typescript
{
  id: uuid,              // Internal database ID
  workosUserId: text,    // WorkOS user ID (unique)
  email: text,           // Synced from WorkOS
  username: text,        // App-specific (not in WorkOS)
  role: text,            // Application role
  imageUrl: text,        // Synced from WorkOS profilePictureUrl
  // ... Stripe fields, preferences, etc.
}
```

### Profiles Table

```typescript
{
  id: uuid,
  workosUserId: text,    // References UsersTable
  firstName: text,       // Synced from WorkOS
  lastName: text,        // Synced from WorkOS
  bio: text,             // User-edited (NOT synced from WorkOS)
  published: boolean,    // App-specific
  // ... Expert-specific fields
}
```

### Organizations Table

```typescript
{
  id: uuid,
  workosOrgId: text,     // WorkOS organization ID
  slug: text,
  name: text,            // Synced from WorkOS
  type: text,            // App-specific: patient_personal, expert_individual, clinic
  // ...
}
```

### UserOrgMemberships Table

```typescript
{
  id: uuid,
  workosUserId: text,    // References UsersTable
  orgId: uuid,           // References OrganizationsTable
  role: text,            // Synced from WorkOS (owner, member, etc.)
  status: text,          // active, inactive, pending
  // ...
}
```

## Configuration

### Environment Variables

```bash
# WorkOS Authentication
WORKOS_API_KEY=sk_xxx              # WorkOS Secret API Key
WORKOS_CLIENT_ID=client_xxx         # WorkOS Client ID
WORKOS_COOKIE_PASSWORD=xxx          # 32+ character password
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

# WorkOS Webhooks
WORKOS_WEBHOOK_SECRET=xxx           # From WorkOS Dashboard
```

### WorkOS Dashboard Setup

1. **Navigate to** [WorkOS Dashboard](https://dashboard.workos.com)
2. **Go to Webhooks** → Add endpoint
3. **Set URL**: `https://yourdomain.com/api/webhooks/workos`
4. **Select events**:
   - All User Management events
   - All Organization events
   - All Directory Sync events (if using SSO)
5. **Copy webhook secret** → Add to `.env`

## Error Handling

### Callback Handler Errors

```typescript
onSuccess: async ({ user }) => {
  try {
    await syncWorkOSUserToDatabase(user);
  } catch (error) {
    // Log but don't throw - authentication succeeds
    console.error('Sync failed (non-blocking):', error);
  }
};
```

### Webhook Handler Errors

```typescript
try {
  await fullUserSync(userId);
} catch (error) {
  console.error('Webhook sync failed:', error);
  // Return 500 to trigger WorkOS retry
  return NextResponse.json({ error }, { status: 500 });
}
```

### Retry Logic

WorkOS automatically retries failed webhooks:

- Retry intervals: 1m, 5m, 30m, 2h, 5h, 10h, 10h
- After 7 retries (≈24 hours), webhook is marked as failed
- Check WorkOS Dashboard for failed webhooks

## Best Practices

### 1. Always Fetch from WorkOS

```typescript
// ✅ Good - Fetch from WorkOS
const workosUser = await workos.userManagement.getUser(userId);
await syncWorkOSUserToDatabase(workosUser);

// ❌ Bad - Trust webhook data without verification
await syncWorkOSUserToDatabase(webhookData);
```

### 2. Use Upserts

```typescript
// ✅ Good - Upsert (create or update)
const existingUser = await db.query.UsersTable.findFirst(...);
if (existingUser) {
  await db.update(UsersTable).set(...);
} else {
  await db.insert(UsersTable).values(...);
}

// ❌ Bad - Assume record exists
await db.update(UsersTable).set(...); // Fails if not exists
```

### 3. Preserve User-Edited Fields

```typescript
// ✅ Good - Only sync WorkOS-owned fields
await db.update(ProfilesTable).set({
  firstName: workosUser.firstName, // Sync from WorkOS
  lastName: workosUser.lastName, // Sync from WorkOS
  // bio: preserved (user-edited)
  // published: preserved (app-specific)
});

// ❌ Bad - Overwrite all fields
await db.update(ProfilesTable).set(workosUser);
```

### 4. Return 200 Quickly

```typescript
// ✅ Good - Return 200, then process
const result = await syncUser(event.data.id);
return NextResponse.json({ received: true }, { status: 200 });

// ❌ Bad - Long processing before returning
await syncUser();
await syncMemberships();
await sendEmail();
return NextResponse.json({ received: true });
```

## Troubleshooting

### User Data Not Syncing

1. **Check callback handler logs**: Look for sync errors
2. **Verify environment variables**: Ensure WORKOS_API_KEY is set
3. **Test webhook endpoint**: Send test event from WorkOS Dashboard
4. **Check webhook signature**: Ensure WORKOS_WEBHOOK_SECRET matches

### Profile Data Missing

1. **Check if profile exists**: Query ProfilesTable
2. **Verify callback sync**: Check logs for profile sync
3. **Manual sync**: Call `fullUserSync(userId)` in server action

### Webhook Not Received

1. **Check webhook URL**: Ensure publicly accessible
2. **Verify TLS/SSL**: WorkOS requires HTTPS in production
3. **Check firewall**: Ensure endpoint not blocked
4. **View logs**: Check WorkOS Dashboard → Webhooks → Logs

### Duplicate Users

1. **Check for race conditions**: Multiple callbacks at once
2. **Use database constraints**: UNIQUE on workosUserId
3. **Add retry logic**: Handle constraint violations gracefully

## Testing

### Manual Testing

```typescript
// Test sync function
import { fullUserSync } from '@/lib/integrations/workos/sync';

await fullUserSync('user_01H...');
```

### Webhook Testing

1. **Use WorkOS Dashboard**: Send test events
2. **Check logs**: Verify events received and processed
3. **Verify database**: Check data updated correctly

### Integration Testing

```typescript
// Test complete auth flow
test('user registration syncs data', async () => {
  // 1. Trigger sign-up
  // 2. Verify user in database
  // 3. Verify profile created
  // 4. Verify organization created
});
```

## Related Documentation

- [WorkOS AuthKit Integration](../09-integrations/workos-authkit.md)
- [Role-Based Access Control](./role-based-authorization.md)
- [Database Schema](../../drizzle/schema-workos.ts)
- [WorkOS Official Docs](https://workos.com/docs/user-management)

## Support

For issues or questions:

1. Check WorkOS Dashboard → Support
2. Review webhook logs in dashboard
3. Check application logs for sync errors
4. Contact WorkOS support: support@workos.com
