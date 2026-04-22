/**
 * LogoutButton Component
 *
 * Client-side logout button with loading states and error handling.
 * Follows brijr pattern with elegant UX.
 *
 * Usage:
 * ```tsx
 * <LogoutButton />
 * // or with custom text
 * <LogoutButton>Sign Out</LogoutButton>
 * ```
 */

'use client';

import { Button } from '@/components/ui/button';
import { signOut } from '@workos-inc/authkit-nextjs';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * LogoutButton Component
 *
 * Client-side logout button with loading states and error handling.
 * Follows brijr pattern with elegant UX.
 *
 * Usage:
 * ```tsx
 * <LogoutButton />
 * // or with custom text
 * <LogoutButton>Sign Out</LogoutButton>
 * ```
 */

/**
 * LogoutButton Component
 *
 * Client-side logout button with loading states and error handling.
 * Follows brijr pattern with elegant UX.
 *
 * Usage:
 * ```tsx
 * <LogoutButton />
 * // or with custom text
 * <LogoutButton>Sign Out</LogoutButton>
 * ```
 */

interface LogoutButtonProps {
  children?: React.ReactNode;
  /**
   * Where to redirect after logout
   * @default '/'
   */
  redirectTo?: string;
  /**
   * Show confirmation dialog before logout
   * @default false
   */
  confirmBeforeLogout?: boolean;
  /**
   * Button variant
   * @default 'ghost'
   */
  variant?:
    | 'default'
    | 'destructive'
    | 'destructiveGhost'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  /**
   * Button size
   * @default 'default'
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /**
   * Additional className
   */
  className?: string;
}

/**
 * LogoutButton - Client Component for Logout
 *
 * Provides a button that logs the user out when clicked.
 * Includes loading state and error handling.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <LogoutButton />
 *
 * // With confirmation
 * <LogoutButton confirmBeforeLogout>Sign Out</LogoutButton>
 *
 * // Custom styling
 * <LogoutButton variant="destructive" size="sm">
 *   Log out
 * </LogoutButton>
 * ```
 */
export function LogoutButton({
  children,
  redirectTo = '/',
  confirmBeforeLogout = false,
  variant = 'ghost',
  size = 'default',
  className,
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (confirmBeforeLogout) {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (!confirmed) return;
    }

    try {
      setIsLoading(true);
      await signOut();
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <>
          <span className="animate-spin">⏳</span>
          <span className="ml-2">Logging out...</span>
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-4 w-4" />
          {children || 'Log out'}
        </>
      )}
    </Button>
  );
}
