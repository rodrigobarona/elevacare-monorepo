/**
 * Google Calendar Connection Component
 *
 * Provides UI for connecting/disconnecting Google Calendar integration.
 * Shows connection status, handles OAuth flow initiation, and displays errors.
 *
 * Features:
 * - Connect/Disconnect buttons
 * - Connection status indicator
 * - Error handling and display
 * - Loading states
 * - Success confirmations
 *
 * @see server/actions/google-calendar.ts - Server actions
 * @see docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md - Setup guide
 */

'use client';

import { ComponentErrorBoundary } from '@/components/shared/ComponentErrorFallback';
import {
  checkGoogleCalendarConnection,
  connectGoogleCalendar,
  disconnectGoogleCalendarAction,
} from '@/server/actions/google-calendar';
import { CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Google Calendar Connection Component
 *
 * Provides UI for connecting/disconnecting Google Calendar integration.
 * Shows connection status, handles OAuth flow initiation, and displays errors.
 *
 * Features:
 * - Connect/Disconnect buttons
 * - Connection status indicator
 * - Error handling and display
 * - Loading states
 * - Success confirmations
 *
 * @see server/actions/google-calendar.ts - Server actions
 * @see docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md - Setup guide
 */

/**
 * Google Calendar Connection Component
 *
 * Provides UI for connecting/disconnecting Google Calendar integration.
 * Shows connection status, handles OAuth flow initiation, and displays errors.
 *
 * Features:
 * - Connect/Disconnect buttons
 * - Connection status indicator
 * - Error handling and display
 * - Loading states
 * - Success confirmations
 *
 * @see server/actions/google-calendar.ts - Server actions
 * @see docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md - Setup guide
 */

/**
 * Google Calendar Connection Component
 *
 * Provides UI for connecting/disconnecting Google Calendar integration.
 * Shows connection status, handles OAuth flow initiation, and displays errors.
 *
 * Features:
 * - Connect/Disconnect buttons
 * - Connection status indicator
 * - Error handling and display
 * - Loading states
 * - Success confirmations
 *
 * @see server/actions/google-calendar.ts - Server actions
 * @see docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md - Setup guide
 */

/**
 * Google Calendar Connection Component
 *
 * Provides UI for connecting/disconnecting Google Calendar integration.
 * Shows connection status, handles OAuth flow initiation, and displays errors.
 *
 * Features:
 * - Connect/Disconnect buttons
 * - Connection status indicator
 * - Error handling and display
 * - Loading states
 * - Success confirmations
 *
 * @see server/actions/google-calendar.ts - Server actions
 * @see docs/09-integrations/WORKOS-GOOGLE-OAUTH-SETUP.md - Setup guide
 */

interface ConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectedAt?: Date;
}

/**
 * Google Calendar Connection Card
 *
 * Main component for managing Google Calendar integration.
 * Displays current status and provides connect/disconnect actions.
 */
function ConnectGoogleCalendarInner() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: true,
    error: null,
  });

  async function checkConnection() {
    try {
      setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await checkGoogleCalendarConnection();

      if (result.success) {
        setStatus({
          isConnected: result.isConnected,
          isLoading: false,
          error: null,
          connectedAt: result.connectedAt,
        });
      } else {
        setStatus({
          isConnected: false,
          isLoading: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('[Connect Calendar] Error checking status:', error);
      setStatus({
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check connection status',
      });
    }
  }

  // Check connection status on mount
  useEffect(() => {
    let cancelled = false;
    checkGoogleCalendarConnection()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setStatus({
            isConnected: result.isConnected,
            isLoading: false,
            error: null,
            connectedAt: result.connectedAt,
          });
        } else {
          setStatus({
            isConnected: false,
            isLoading: false,
            error: result.error,
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[Connect Calendar] Error checking status:', error);
        setStatus({
          isConnected: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to check connection status',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    try {
      setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await connectGoogleCalendar();

      if (result.success) {
        // Redirect to WorkOS OAuth flow
        window.location.href = result.authorizationUrl;
      } else {
        setStatus((prev) => ({ ...prev, isLoading: false, error: result.message }));
        toast.error(result.message || 'Failed to initiate Google Calendar connection');
      }
    } catch (error) {
      console.error('[Connect Calendar] Error initiating connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate connection';
      setStatus((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      toast.error(errorMessage);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        'Are you sure you want to disconnect Google Calendar? This will disable calendar integration features.',
      )
    ) {
      return;
    }

    try {
      setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

      const result = await disconnectGoogleCalendarAction();

      if (result.success) {
        setStatus({
          isConnected: false,
          isLoading: false,
          error: null,
        });
        toast.success('Google Calendar disconnected successfully');
      } else {
        setStatus((prev) => ({ ...prev, isLoading: false, error: result.message }));
        toast.error(result.message || 'Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('[Connect Calendar] Error disconnecting:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect';
      setStatus((prev) => ({ ...prev, isLoading: false, error: errorMessage }));
      toast.error(errorMessage);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <CalendarIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Google Calendar</h3>
            <p className="text-sm text-muted-foreground">Sync your appointments and meetings</p>
          </div>
        </div>

        {/* Status Badge */}
        {!status.isLoading && (
          <div className="flex items-center gap-2">
            {status.isConnected ? (
              <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <XCircle className="h-4 w-4" />
                Not Connected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        <p>
          Connect your Google Calendar to automatically sync appointments, check availability, and
          create meeting links.
        </p>

        {status.isConnected && status.connectedAt && (
          <p className="text-xs">
            Connected on {new Date(status.connectedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Error Display */}
      {status.error && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Error</p>
          <p className="mt-1">{status.error}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-6 flex items-center gap-3">
        {status.isConnected ? (
          <button
            onClick={handleDisconnect}
            disabled={status.isLoading}
            className="rounded-md border border-destructive bg-transparent px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.isLoading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={status.isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.isLoading ? 'Connecting...' : 'Connect Google Calendar'}
          </button>
        )}

        {status.isConnected && (
          <button
            onClick={checkConnection}
            disabled={status.isLoading}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Refresh Status
          </button>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-4 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          🔐 <strong>Security:</strong> All credentials are encrypted using AES-256-GCM encryption
          before storage. We never store your Google password.
        </p>
      </div>
    </div>
  );
}

export function ConnectGoogleCalendar() {
  return (
    <ComponentErrorBoundary fallbackMessage="Could not load Google Calendar settings">
      <ConnectGoogleCalendarInner />
    </ComponentErrorBoundary>
  );
}

/**
 * Compact Connect Button (for use in settings or other pages)
 */
export function ConnectGoogleCalendarButton({ onSuccess: _onSuccess }: { onSuccess?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkGoogleCalendarConnection()
      .then((result) => {
        if (!cancelled && result.success) {
          setIsConnected(result.isConnected);
        }
      })
      .catch((error) => {
        console.error('Error checking connection:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    try {
      setIsLoading(true);

      const result = await connectGoogleCalendar();

      if (result.success) {
        window.location.href = result.authorizationUrl;
      } else {
        toast.error(result.message || 'Failed to connect');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Failed to initiate connection');
      setIsLoading(false);
    }
  }

  if (isConnected === null) {
    return null; // Loading
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span>Google Calendar Connected</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <CalendarIcon className="h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Connect Calendar'}
    </button>
  );
}

/**
 * Connection Status Indicator (for use in navigation or headers)
 */
export function GoogleCalendarStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkGoogleCalendarConnection()
      .then((result) => {
        if (!cancelled && result.success) {
          startTransition(() => setIsConnected(result.isConnected));
        }
      })
      .catch((error) => {
        console.error('Error checking status:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isConnected === null) {
    return null;
  }

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      title={isConnected ? 'Google Calendar Connected' : 'Google Calendar Not Connected'}
    >
      <div
        className={`h-2 w-2 rounded-full ${
          isConnected ? 'animate-pulse bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      />
      <span className="text-muted-foreground">Calendar</span>
    </div>
  );
}
