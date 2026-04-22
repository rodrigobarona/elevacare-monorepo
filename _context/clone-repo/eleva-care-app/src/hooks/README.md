# Custom Hooks

## User Profile Hooks

### `useUsername()`

Centralized hook to fetch the current user's username. Use this instead of manually fetching from `/api/user/profile`.

**Features:**

- ✅ Two-tier caching (in-memory + Redis)
- ✅ Automatic deduplication across components
- ✅ Loading and error states
- ✅ TypeScript support

**Usage:**

```tsx
import { useUsername } from '@/hooks/use-user-profile';

function MyComponent() {
  const { username, isLoading, error } = useUsername();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading username</div>;

  return <div>Welcome, {username}!</div>;
}
```

### `useUserProfile()`

Get the full user profile with additional data.

**Usage:**

```tsx
import { useUserProfile } from '@/hooks/use-user-profile';

function MyComponent() {
  const { profile, isLoading, error, refresh } = useUserProfile();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;

  return (
    <div>
      <p>Username: {profile?.username}</p>
      <p>Email: {profile?.email}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

## Caching Strategy

### Frontend (In-Memory)

- **Duration:** 1 minute
- **Scope:** Per page load
- **Purpose:** Prevent duplicate API calls within same session
- **Implementation:** JavaScript `Map` with timestamp validation

### Backend (Next.js 16 Native Cache)

- **Duration:** 5 minutes
- **Scope:** Global across all requests (Next.js Data Cache)
- **Purpose:** Reduce database queries
- **Implementation:** `unstable_cache` with tag-based revalidation
- **Invalidation:** `revalidateTag('user-profile-{userId}')` for background updates or `updateTag('user-profile-{userId}')` for immediate updates

### Cache Key Format

- **Frontend:** `Map<workosUserId, { data, timestamp }>`
- **Backend:** `['user-profile-{userId}']` with tags: `['user-profile', 'user-profile-{userId}']`

### Why Not `'use cache'`?

Next.js 16's `'use cache'` directive is designed for **Server Components only**, not API routes. For API routes and Server Actions, we use `unstable_cache` which provides:

- ✅ Tag-based cache invalidation
- ✅ Time-based revalidation
- ✅ Per-user cache isolation
- ✅ Built into Next.js (no external dependencies)

## Migration from Old Pattern

**Before:**

```tsx
const [username, setUsername] = useState<string>('');

useEffect(() => {
  if (user) {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.username) {
          setUsername(data.user.username);
        }
      })
      .catch(console.error);
  }
}, [user]);
```

**After:**

```tsx
const { username, isLoading } = useUsername();
```

## Components to Update

The following components should be migrated to use the new hooks:

- ✅ `/components/layout/sidebar/AppSidebar.tsx`
- ✅ `/components/features/forms/EventForm.tsx`
- [ ] Any other components fetching user profile data

## Performance Benefits

1. **Reduced API Calls:** Multiple components calling `useUsername()` only trigger one API request
2. **Faster Load Times:** In-memory cache provides instant data for subsequent renders
3. **Lower Database Load:** Next.js 16 native cache reduces database queries by 80%+
4. **Better UX:** Loading states are centralized and consistent
5. **Native Integration:** Uses Next.js built-in Data Cache (no external services required)
6. **Selective Invalidation:** Tag-based system allows precise cache updates
