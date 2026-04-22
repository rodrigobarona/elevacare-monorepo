/**
 * Custom hook to fetch and cache user profile data from WorkOS
 *
 * This hook centralizes the logic for fetching username and other profile data
 * that WorkOS doesn't provide directly. Uses React state with in-memory caching.
 *
 * Backend caching via Redis is handled in /api/user/profile route.
 */
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { startTransition, useEffect, useState } from 'react';

export interface UserProfile {
  id: string;
  workosUserId: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  imageUrl: string | null;
  country: string | null;
  stripeCustomerId: string | null;
  stripeConnectAccountId: string | null;
}

// In-memory cache to avoid duplicate fetches across components
const profileCache = new Map<string, { data: UserProfile; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute

/**
 * Hook to get the current user's username
 * Leverages Redis caching on the backend + in-memory cache on frontend
 */
export function useUsername() {
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      startTransition(() => setIsLoading(false));
      return;
    }

    const cacheKey = user.id;
    const cached = profileCache.get(cacheKey);

    // Use cache if valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      startTransition(() => {
        setUsername(cached.data.username);
        setIsLoading(false);
      });
      return;
    }

    // Fetch from API (which uses Redis cache)
    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data) => {
        const profile = data.user as UserProfile;
        profileCache.set(cacheKey, { data: profile, timestamp: Date.now() });
        setUsername(profile.username);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching username:', err);
        setError(err);
      })
      .finally(() => setIsLoading(false));
  }, [user]);

  return { username, isLoading, error };
}

/**
 * Hook to get the full user profile
 * Leverages Redis caching on the backend + in-memory cache on frontend
 */
export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = () => {
    if (!user) {
      startTransition(() => setIsLoading(false));
      return;
    }

    const cacheKey = user.id;
    const cached = profileCache.get(cacheKey);

    // Use cache if valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      startTransition(() => {
        setProfile(cached.data);
        setIsLoading(false);
      });
      return;
    }

    // Fetch from API (which uses Redis cache)
    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data) => {
        const profileData = data.user as UserProfile;
        profileCache.set(cacheKey, { data: profileData, timestamp: Date.now() });
        setProfile(profileData);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
        setError(err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refresh = () => {
    if (user) {
      profileCache.delete(user.id);
      fetchProfile();
    }
  };

  return { profile, isLoading, error, refresh };
}
