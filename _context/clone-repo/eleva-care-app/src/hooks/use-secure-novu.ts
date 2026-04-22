import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useCounts } from '@novu/react';
import { useEffect, useState } from 'react';

interface SecureSubscriberData {
  subscriberId: string;
  subscriberHash: string;
  applicationIdentifier: string;
}

interface UseSecureNovuResult {
  subscriberData: SecureSubscriberData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to securely fetch HMAC-hashed subscriber data for Novu
 * This ensures that notification feeds are protected from unauthorized access
 *
 * @returns Object containing subscriber data, loading state, and error state
 */
export function useSecureNovu(): UseSecureNovuResult {
  const { user, loading } = useAuth();
  const isLoaded = !loading;
  const userId = user?.id;
  const [subscriberData, setSubscriberData] = useState<SecureSubscriberData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriberData = async () => {
    if (!userId || !isLoaded) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/novu/subscriber-hash', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Handle both wrapped and direct response formats
      if (result.subscriberId) {
        setSubscriberData(result);
      } else if (result.success && result.data) {
        setSubscriberData(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch subscriber data';
      setError(errorMessage);
      console.error('Error fetching secure subscriber data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriberData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isLoaded]);

  return {
    subscriberData,
    isLoading,
    error,
    refetch: fetchSubscriberData,
  };
}

/**
 * Hook specifically for getting subscriber data for Novu Inbox component
 * Returns ready-to-use props for the Inbox component
 */
export function useNovuInboxProps() {
  const { subscriberData, isLoading, error } = useSecureNovu();

  return {
    // Props for Novu Inbox component
    applicationIdentifier:
      subscriberData?.applicationIdentifier || process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER,
    subscriberId: subscriberData?.subscriberId,
    subscriberHash: subscriberData?.subscriberHash,
    apiUrl: 'https://eu.api.novu.co',
    socketUrl: 'https://eu.ws.novu.co',

    // State management
    isReady: !isLoading && !error && !!subscriberData,
    isLoading,
    error,
  };
}

/**
 * Hook that combines secure authentication with real Novu notification counts
 * This ensures we only fetch counts when properly authenticated and ready
 */
export function useSecureNovuCounts() {
  const { subscriberData, isLoading: authLoading, error: authError } = useSecureNovu();

  // Only fetch counts when we have valid subscriber data
  const shouldFetchCounts = !authLoading && !authError && !!subscriberData;

  const {
    counts,
    isLoading: countsLoading,
    error: countsError,
    refetch,
  } = useCounts({
    filters: [{ read: false }], // Get unread count
    onError: (error) => {
      console.error('Error fetching notification counts:', error);
    },
  });

  // Extract the unread count from the first filter
  const unreadCount = shouldFetchCounts ? (counts?.[0]?.count ?? 0) : 0;

  return {
    unreadCount,
    isLoading: authLoading || (shouldFetchCounts && countsLoading),
    error: authError || (shouldFetchCounts ? countsError : null),
    isReady: shouldFetchCounts && !countsLoading && !countsError,
    refetch,
  };
}
