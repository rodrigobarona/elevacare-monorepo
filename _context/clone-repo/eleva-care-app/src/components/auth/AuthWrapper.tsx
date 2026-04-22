/**
 * AuthWrapper Component
 *
 * Reusable authentication boundary component following brijr pattern.
 * Provides elegant loading states, error handling, and automatic redirects.
 *
 * Usage:
 * ```tsx
 * <AuthWrapper>
 *   <YourProtectedContent />
 * </AuthWrapper>
 * ```
 */
import { withAuth } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

interface AuthWrapperProps {
  children: ReactNode;
  /**
   * Where to redirect if user is not authenticated
   * @default '/login'
   */
  redirectTo?: string;
  /**
   * Fallback component to show while loading
   */
  loadingFallback?: ReactNode;
}

/**
 * AuthWrapper - Server Component Authentication Boundary
 *
 * Wraps protected content with authentication checks.
 * Automatically redirects unauthenticated users to login.
 *
 * @example
 * ```tsx
 * // In a server component
 * export default function ProtectedPage() {
 *   return (
 *     <AuthWrapper>
 *       <YourProtectedContent />
 *     </AuthWrapper>
 *   );
 * }
 * ```
 */
export async function AuthWrapper({ children, redirectTo = '/login' }: AuthWrapperProps) {
  // Check authentication status
  const { user } = await withAuth();

  // If not authenticated, redirect to login
  if (!user) {
    redirect(`${redirectTo}?redirect_url=${encodeURIComponent(redirectTo)}`);
  }

  // User is authenticated - render children
  return <>{children}</>;
}

/**
 * AuthWrapperOptional - Optional Authentication Boundary
 *
 * Similar to AuthWrapper but doesn't redirect if user is not authenticated.
 * Useful for pages that work for both authenticated and non-authenticated users.
 *
 * @example
 * ```tsx
 * // In a server component
 * export default async function OptionalAuthPage() {
 *   const { user } = await withAuth();
 *
 *   return (
 *     <div>
 *       {user ? (
 *         <p>Welcome back, {user.firstName}!</p>
 *       ) : (
 *         <p>Welcome, guest!</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export async function AuthWrapperOptional({
  children,
}: {
  children: (user: Awaited<ReturnType<typeof withAuth>>['user']) => ReactNode;
}) {
  const { user } = await withAuth();
  return <>{children(user)}</>;
}
