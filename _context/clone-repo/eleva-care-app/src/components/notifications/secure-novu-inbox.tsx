'use client';

import { SidebarMenuButton } from '@/components/layout/sidebar/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENV_CONFIG } from '@/config/env';
import { useNovuInboxProps } from '@/hooks/use-secure-novu';
import { Bell, Inbox, InboxContent, Notifications } from '@novu/react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface SecureNovuInboxProps {
  className?: string;
}

/**
 * Modern Secure Novu Inbox component with best practices from Context7
 * Features:
 * - HMAC authentication for security
 * - Clean modern UI with proper styling
 * - Responsive design
 * - Error handling and loading states
 */
export function SecureNovuInbox({ className = '' }: SecureNovuInboxProps) {
  const { applicationIdentifier, subscriberId, subscriberHash, isReady, isLoading, error } =
    useNovuInboxProps();

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading notifications...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load notifications: {error}</span>
          </div>
        </div>
      </div>
    );
  }

  // Not ready state
  if (!isReady || !applicationIdentifier || !subscriberId || !subscriberHash) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertCircle className="h-5 w-5" />
            <span>Notification system initializing...</span>
          </div>
        </div>
      </div>
    );
  }

  // Custom appearance for modern styling
  const appearance = {
    variables: {
      colorBackground: 'hsl(var(--background))',
      colorForeground: 'hsl(var(--foreground))',
      colorPrimary: 'hsl(var(--primary))',
      colorSecondary: 'hsl(var(--secondary))',
      colorCounter: 'hsl(var(--destructive))',
      fontSize: '14px',
      borderRadius: '0.5rem',
    },
    elements: {
      bellContainer: 'p-0',
      bellIcon: 'h-5 w-5',
      notification: 'border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors',
      notificationContainer: 'p-0',
      notificationsList: 'max-h-[400px] overflow-y-auto',
      notificationItem: 'p-4',
      inboxContainer: 'border-0 shadow-none',
    },
  };

  return (
    <div className={className}>
      <Inbox
        applicationIdentifier={applicationIdentifier}
        subscriberId={subscriberId}
        subscriberHash={subscriberHash}
        backendUrl={ENV_CONFIG.NOVU_BASE_URL}
        socketUrl={ENV_CONFIG.NOVU_SOCKET_URL}
        appearance={appearance}
      >
        <Notifications />
      </Inbox>
    </div>
  );
}

/**
 * Compact notification dropdown for sidebar/navigation use
 * Uses modern Radix UI integration pattern from Context7
 */
export function NotificationDropdown({ className = '' }: { className?: string }) {
  const { applicationIdentifier, subscriberId, subscriberHash, isReady, isLoading, error } =
    useNovuInboxProps();

  if (
    isLoading ||
    error ||
    !isReady ||
    !applicationIdentifier ||
    !subscriberId ||
    !subscriberHash
  ) {
    return (
      <div className={`w-80 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {error && <AlertCircle className="h-4 w-4" />}
          <span>{isLoading ? 'Loading...' : error ? 'Unavailable' : 'Initializing...'}</span>
        </div>
      </div>
    );
  }

  // Modern appearance optimized for dropdown
  const appearance = {
    variables: {
      colorBackground: 'hsl(var(--popover))',
      colorForeground: 'hsl(var(--popover-foreground))',
      colorPrimary: 'hsl(var(--primary))',
      colorSecondary: 'hsl(var(--secondary))',
      colorCounter: 'hsl(var(--destructive))',
      fontSize: '14px',
      borderRadius: '0.5rem',
    },
    elements: {
      bellContainer: 'p-0',
      bellIcon: 'h-5 w-5',
      notification: 'border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors',
      notificationContainer: 'p-0',
      notificationsList: 'max-h-[320px] overflow-y-auto',
      notificationItem: 'p-3',
      inboxContainer: 'border-0 shadow-none',
    },
  };

  return (
    <div className={`w-80 ${className}`}>
      <Inbox
        applicationIdentifier={applicationIdentifier}
        subscriberId={subscriberId}
        subscriberHash={subscriberHash}
        backendUrl={ENV_CONFIG.NOVU_BASE_URL}
        socketUrl={ENV_CONFIG.NOVU_SOCKET_URL}
        appearance={appearance}
      >
        <InboxContent />
      </Inbox>

      {/* Footer with View All link */}
      <div className="border-t bg-muted/20 p-3">
        <Link
          href="/account/notifications"
          className="flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          View All Notifications
        </Link>
      </div>
    </div>
  );
}

/**
 * Enhanced bell component with better integration
 * Uses Context7 best practices for bell icons and sidebar integration
 */
export function EnhancedNotificationBell({
  className = '',
  showDropdown = true,
}: {
  className?: string;
  showDropdown?: boolean;
}) {
  const { applicationIdentifier, subscriberId, subscriberHash, isReady } = useNovuInboxProps();

  if (!isReady || !applicationIdentifier || !subscriberId || !subscriberHash) {
    if (!showDropdown) {
      return (
        <Link href="/account/notifications" className={className}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent">
            <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
          </div>
        </Link>
      );
    }

    return (
      <SidebarMenuButton asChild>
        <Link href="/account/notifications">
          <div className="flex h-5 w-5 items-center justify-center">
            <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
          </div>
          <span>Notifications</span>
        </Link>
      </SidebarMenuButton>
    );
  }

  const bellAppearance = {
    variables: {
      colorCounter: 'hsl(var(--destructive))',
    },
    elements: {
      bellContainer: showDropdown
        ? 'flex h-5 w-5 items-center justify-center'
        : 'relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      bellIcon: 'h-4 w-4',
    },
  };

  if (!showDropdown) {
    return (
      <Link href="/account/notifications" className={className}>
        <Inbox
          applicationIdentifier={applicationIdentifier}
          subscriberId={subscriberId}
          subscriberHash={subscriberHash}
          backendUrl={ENV_CONFIG.NOVU_BASE_URL}
          socketUrl={ENV_CONFIG.NOVU_SOCKET_URL}
          appearance={bellAppearance}
        >
          <Bell />
        </Inbox>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className={`focus:outline-hidden ${className}`}>
          <Inbox
            applicationIdentifier={applicationIdentifier}
            subscriberId={subscriberId}
            subscriberHash={subscriberHash}
            backendUrl={ENV_CONFIG.NOVU_BASE_URL}
            socketUrl={ENV_CONFIG.NOVU_SOCKET_URL}
            appearance={bellAppearance}
          >
            <Bell />
          </Inbox>
          <span>Notifications</span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-80 p-0">
        <NotificationDropdown />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
